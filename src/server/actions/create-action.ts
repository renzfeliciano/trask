import "server-only";
import { z } from "zod";
import type { Result } from "@/lib/result";
import { assertCan, type Permission } from "@/server/authz/permissions";
import type { Role } from "@/server/authz/roles";
import {
  AppError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "@/server/errors/app-error";
import { toSafeError } from "@/server/errors/to-safe-error";
import type { AuthPort } from "@/server/ports/auth";
import type { Logger } from "@/server/ports/logger";

export type AuthContext = { userId: string };
/**
 * The caller after their role in `workspaceId` was checked. Repositories for workspace-owned data take it and use
 * `withWorkspace(ctx)` (src/db/tenant.ts), so the database confines the handler to this one workspace.
 */
export type WorkspaceCtx = { userId: string; workspaceId: string; role: Role };
type PublicCtx = { userId: string | null };

export interface CreateActionDeps {
  auth: AuthPort;
  findRole: (ctx: AuthContext, workspaceId: string) => Promise<Role | null>;
  logger: Logger;
}

/** What a Server Action looks like to its caller: untrusted input in, a Result out. */
type Action<T> = (input: unknown) => Promise<Result<T>>;

type InputSchema = z.ZodObject;

// `name` is a stable identifier used in logs (e.g. "task.create"); it never reaches the client.
interface BaseConfig<S extends InputSchema> {
  name: string;
  input: S;
}

// The `?: never` members make the three modes mutually exclusive at compile time.
interface WorkspaceActionConfig<S extends InputSchema, T> extends BaseConfig<S> {
  permission: Permission;
  workspaceId: (input: z.output<S>) => string;
  handler: (ctx: WorkspaceCtx, input: z.output<S>) => Promise<T>;
  authenticated?: never;
  public?: never;
}

interface AuthenticatedActionConfig<S extends InputSchema, T> extends BaseConfig<S> {
  authenticated: true;
  handler: (ctx: AuthContext, input: z.output<S>) => Promise<T>;
  permission?: never;
  public?: never;
}

interface PublicActionConfig<S extends InputSchema, T> extends BaseConfig<S> {
  public: true;
  handler: (ctx: PublicCtx, input: z.output<S>) => Promise<T>;
  permission?: never;
  authenticated?: never;
}

type ActionConfig<S extends InputSchema, T> =
  WorkspaceActionConfig<S, T> | AuthenticatedActionConfig<S, T> | PublicActionConfig<S, T>;

type AnyConfig = ActionConfig<InputSchema, unknown>;

export type CreateAction = <S extends InputSchema, T>(config: ActionConfig<S, T>) => Action<T>;

// Functions built by createAction. Module-private and held outside the function objects, so no other module can mark
// a raw handler as wrapped, and copying a wrapped action's properties onto another function does not copy the mark.
const wrappedActions = new WeakSet<object>();

function brandAction<F extends (input: unknown) => Promise<unknown>>(fn: F): F {
  wrappedActions.add(fn);
  return fn;
}

/** True when `value` was produced by createAction. */
export function isAction(value: unknown): boolean {
  return typeof value === "function" && wrappedActions.has(value);
}

/** Names of a module's exported functions that were not built with createAction. Non-function exports are ignored. */
export function findUnwrappedExports(mod: Record<string, unknown>): string[] {
  return Object.entries(mod)
    .filter(([, value]) => typeof value === "function" && !isAction(value))
    .map(([name]) => name);
}

const uuidSchema = z.uuid();
const ROOT_FIELD = "_root";
const UNKNOWN_FIELD_MESSAGE = "This field isn't accepted.";
const SAFE_ERROR_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/** Zod issues as field errors keyed by dotted path. Unknown keys get a fixed message so input never echoes back. */
function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields = new Map<string, string[]>();
  const add = (key: string, message: string): void => {
    fields.set(key, [...(fields.get(key) ?? []), message]);
  };
  for (const issue of error.issues) {
    const path = issue.path.map(String);
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) add([...path, key].join("."), UNKNOWN_FIELD_MESSAGE);
    } else {
      add(path.length > 0 ? path.join(".") : ROOT_FIELD, issue.message);
    }
  }
  // fromEntries defines own properties, so a "__proto__" key from input cannot touch the prototype.
  return Object.fromEntries(fields);
}

/** Only allow-listed facts about an unexpected error are logged: never its message, stack, cause or the input. */
function logFields(action: string, userId: string | null, err: unknown) {
  const code = typeof err === "object" && err !== null && "code" in err ? err.code : null;
  return {
    action,
    userId,
    errorName: err instanceof Error ? err.name : "NonError",
    errorCode: typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : null,
  };
}

function modeCount(config: AnyConfig): number {
  return [
    config.permission !== undefined,
    config.authenticated === true,
    config.public === true,
  ].filter(Boolean).length;
}

/**
 * Builds `createAction`, the only way to define a Server Action. Default deny: every action declares exactly one
 * access mode, and checks run in a fixed order — session, verified email, strict input, workspace role, permission —
 * before the handler. Anything thrown becomes a SafeError; unexpected failures are logged, never returned.
 */
export function createActionFactory(deps: CreateActionDeps): CreateAction {
  function createAction(config: AnyConfig): Action<unknown> {
    if (modeCount(config) !== 1) {
      throw new Error(
        `createAction("${config.name}") must declare exactly one of permission, authenticated: true or public: true.`,
      );
    }
    const schema = config.input.strict();

    return brandAction(async (rawInput: unknown): Promise<Result<unknown>> => {
      let userId: string | null = null;
      try {
        const session = await deps.auth.getSession();
        const verified = session?.emailVerified === true ? session : null;
        if (config.public !== true) {
          if (!session) throw new AuthenticationError();
          if (!verified) throw new AuthenticationError("Verify your email to continue.");
        }
        userId = verified?.userId ?? null;

        const parsed = schema.safeParse(rawInput);
        if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));
        const input = parsed.data;

        let data: unknown;
        if (config.public === true) {
          data = await config.handler({ userId }, input);
        } else if (userId === null) {
          // Unreachable after the session checks above; it narrows userId for the branches below.
          throw new AuthenticationError();
        } else if (config.authenticated === true) {
          data = await config.handler({ userId }, input);
        } else {
          const workspaceId = config.workspaceId(input);
          // A malformed id cannot name a workspace the user belongs to, so it gets the same answer as a non-member.
          if (!uuidSchema.safeParse(workspaceId).success) throw new NotFoundError();
          const role = await deps.findRole({ userId }, workspaceId);
          // Non-members get NOT_FOUND, not AUTHORIZATION, so the workspace's existence is not revealed.
          if (role === null) throw new NotFoundError();
          assertCan({ role }, config.permission);
          data = await config.handler({ userId, workspaceId, role }, input);
        }
        return { ok: true, data };
      } catch (err) {
        const error = toSafeError(err);
        if (!(err instanceof AppError) || error.code === "INTERNAL") {
          deps.logger.error(logFields(config.name, userId, err), "Server action failed");
        }
        return { ok: false, error };
      }
    });
  }

  return createAction as CreateAction;
}
