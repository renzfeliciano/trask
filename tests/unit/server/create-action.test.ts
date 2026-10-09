import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Role } from "@/server/authz/roles";
import {
  createActionFactory,
  type AuthContext,
  type CreateActionDeps,
  type WorkspaceCtx,
} from "@/server/actions/create-action";
import { AuthorizationError } from "@/server/errors/app-error";
import type { AuthPort } from "@/server/ports/auth";
import type { Logger } from "@/server/ports/logger";

const USER_ID = "0199a1b2-0000-7000-8000-000000000001";
const WORKSPACE_ID = "0199a1b2-0000-7000-8000-0000000000aa";

type Session = Awaited<ReturnType<AuthPort["getSession"]>>;
type LogEntry = { level: "debug" | "info" | "warn" | "error"; obj: object; msg: string };

function memoryLogger(entries: LogEntry[] = []): Logger & { entries: LogEntry[] } {
  const at =
    (level: LogEntry["level"]) =>
    (obj: object, msg: string): void => {
      entries.push({ level, obj, msg });
    };
  return {
    entries,
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
    child: () => memoryLogger(entries),
  };
}

function setup(options: { session?: Session; role?: Role | null } = {}) {
  const session: Session =
    options.session === undefined ? { userId: USER_ID, emailVerified: true } : options.session;
  const role = options.role === undefined ? "MEMBER" : options.role;
  const auth: AuthPort = { getSession: vi.fn(() => Promise.resolve(session)) };
  const findRole = vi.fn<CreateActionDeps["findRole"]>(() => Promise.resolve(role));
  const logger = memoryLogger();
  const createAction = createActionFactory({ auth, findRole, logger });
  return { createAction, findRole, logger };
}

const createTaskInput = z.object({ workspaceId: z.string(), title: z.string().min(1) });

function createTaskAction(
  createAction: ReturnType<typeof setup>["createAction"],
  handler = vi.fn((_ctx: WorkspaceCtx, input: { title: string }) =>
    Promise.resolve({ title: input.title }),
  ),
) {
  const action = createAction({
    name: "task.create",
    input: createTaskInput,
    permission: "task.create",
    workspaceId: (input) => input.workspaceId,
    handler,
  });
  return { action, handler };
}

describe("createAction: workspace actions", () => {
  it("rejects a request without a session before running the handler", async () => {
    const { createAction, findRole } = setup({ session: null });
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "AUTHENTICATION" } });
    expect(handler).not.toHaveBeenCalled();
    expect(findRole).not.toHaveBeenCalled();
  });

  it("rejects a session whose email is not verified", async () => {
    const { createAction } = setup({ session: { userId: USER_ID, emailVerified: false } });
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toEqual({
      ok: false,
      error: { code: "AUTHENTICATION", message: "Verify your email to continue." },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks mass assignment: an unknown input key is a validation error", async () => {
    const { createAction, findRole } = setup();
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x", role: "OWNER" });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(JSON.stringify(result)).not.toContain("OWNER");
    expect(handler).not.toHaveBeenCalled();
    expect(findRole).not.toHaveBeenCalled();
  });

  it("maps schema issues to field errors keyed by dotted path without echoing input values", async () => {
    const { createAction } = setup();
    const action = createAction({
      name: "task.update",
      input: z.object({
        workspaceId: z.string(),
        task: z.object({ title: z.string().min(3) }),
      }),
      permission: "task.update",
      workspaceId: (input) => input.workspaceId,
      handler: () => Promise.resolve(null),
    });

    const result = await action({ workspaceId: WORKSPACE_ID, task: { title: "zq" } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(Object.keys(result.error.fieldErrors ?? {})).toEqual(["task.title"]);
    expect(JSON.stringify(result)).not.toContain("zq");
  });

  it("answers NOT_FOUND, not AUTHORIZATION, when the user is not a member", async () => {
    const { createAction } = setup({ role: null });
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND without a role lookup when the workspace id is not a UUID", async () => {
    const { createAction, findRole } = setup();
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: "not-a-uuid", title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(findRole).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("denies a VIEWER calling a task.create action", async () => {
    const { createAction } = setup({ role: "VIEWER" });
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "AUTHORIZATION" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler for a MEMBER with the role taken from findRole, never from input", async () => {
    const { createAction, findRole } = setup({ role: "MEMBER" });
    const { action, handler } = createTaskAction(createAction);

    const result = await action({ workspaceId: WORKSPACE_ID, title: "Write the brief" });

    expect(result).toEqual({ ok: true, data: { title: "Write the brief" } });
    expect(findRole).toHaveBeenCalledWith({ userId: USER_ID }, WORKSPACE_ID);
    expect(handler).toHaveBeenCalledWith(
      { userId: USER_ID, workspaceId: WORKSPACE_ID, role: "MEMBER" },
      { workspaceId: WORKSPACE_ID, title: "Write the brief" },
    );
  });

  it("lowercases the workspace id before the role lookup and in the handler context", async () => {
    const { createAction, findRole } = setup({ role: "MEMBER" });
    const { action, handler } = createTaskAction(createAction);
    const upper = WORKSPACE_ID.toUpperCase();
    expect(upper).not.toBe(WORKSPACE_ID);

    const result = await action({ workspaceId: upper, title: "Write the brief" });

    expect(result).toMatchObject({ ok: true });
    expect(findRole).toHaveBeenCalledWith({ userId: USER_ID }, WORKSPACE_ID);
    expect(handler.mock.calls[0]?.[0]).toEqual({
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      role: "MEMBER",
    });
  });

  it("hides an unexpected handler failure and logs one allow-listed error entry", async () => {
    const { createAction, logger } = setup();
    const { action } = createTaskAction(
      createAction,
      vi.fn(() => Promise.reject(new Error("db exploded"))),
    );

    const result = await action({ workspaceId: WORKSPACE_ID, title: "secret title" });

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(result)).not.toContain("db exploded");
    const errors = logger.entries.filter((entry) => entry.level === "error");
    expect(errors).toHaveLength(1);
    const [entry] = errors;
    expect(entry?.obj).toEqual({
      action: "task.create",
      userId: USER_ID,
      errorName: "Error",
      errorCode: null,
    });
    expect(Object.keys(entry?.obj ?? {}).sort()).toEqual([
      "action",
      "errorCode",
      "errorName",
      "userId",
    ]);
    expect(JSON.stringify(entry)).not.toContain("db exploded");
    expect(JSON.stringify(entry)).not.toContain("secret title");
  });

  it("logs the string code of a non-AppError (e.g. a Prisma P-code) and never its message", async () => {
    const { createAction, logger } = setup();
    const prismaError = Object.assign(new Error("Unique constraint failed on title=secret"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    const { action } = createTaskAction(
      createAction,
      vi.fn(() => Promise.reject(prismaError)),
    );

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.obj).toEqual({
      action: "task.create",
      userId: USER_ID,
      errorName: "PrismaClientKnownRequestError",
      errorCode: "P2002",
    });
    expect(JSON.stringify(logger.entries)).not.toContain("secret");
  });

  it("does not log expected application errors", async () => {
    const { createAction, logger } = setup();
    const { action } = createTaskAction(
      createAction,
      vi.fn(() => Promise.reject(new AuthorizationError())),
    );

    const result = await action({ workspaceId: WORKSPACE_ID, title: "x" });

    expect(result).toMatchObject({ ok: false, error: { code: "AUTHORIZATION" } });
    expect(logger.entries).toHaveLength(0);
  });
});

describe("createAction: authenticated and public actions", () => {
  it("passes only the user id to an authenticated action", async () => {
    const { createAction, findRole } = setup();
    const handler = vi.fn((ctx: AuthContext) => Promise.resolve(ctx.userId));
    const action = createAction({
      name: "profile.read",
      input: z.object({}),
      authenticated: true,
      handler,
    });

    const result = await action({});

    expect(result).toEqual({ ok: true, data: USER_ID });
    expect(handler).toHaveBeenCalledWith({ userId: USER_ID }, {});
    expect(findRole).not.toHaveBeenCalled();
  });

  it("rejects an authenticated action without a session", async () => {
    const { createAction } = setup({ session: null });
    const handler = vi.fn(() => Promise.resolve(null));
    const action = createAction({
      name: "profile.read",
      input: z.object({}),
      authenticated: true,
      handler,
    });

    expect(await action({})).toMatchObject({ ok: false, error: { code: "AUTHENTICATION" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs a public action without a session and gives the handler userId null", async () => {
    const { createAction } = setup({ session: null });
    const handler = vi.fn((_ctx: { userId: string | null }, input: { email: string }) =>
      Promise.resolve(input.email.length),
    );
    const action = createAction({
      name: "waitlist.join",
      input: z.object({ email: z.string() }),
      public: true,
      handler,
    });

    const result = await action({ email: "a@b.co" });

    expect(result).toEqual({ ok: true, data: 6 });
    expect(handler).toHaveBeenCalledWith({ userId: null }, { email: "a@b.co" });
  });

  it("treats an unverified session as anonymous in a public action", async () => {
    const { createAction } = setup({ session: { userId: USER_ID, emailVerified: false } });
    const handler = vi.fn(() => Promise.resolve(null));
    const action = createAction({
      name: "waitlist.join",
      input: z.object({}),
      public: true,
      handler,
    });

    await action({});

    expect(handler).toHaveBeenCalledWith({ userId: null }, {});
  });

  it("refuses at definition time a config that declares no access mode", () => {
    const { createAction } = setup();
    const config = { name: "oops", input: z.object({}), handler: () => Promise.resolve(null) };

    // @ts-expect-error -- the types already reject a config without permission, authenticated or public.
    expect(() => createAction(config)).toThrow(/exactly one/);
  });

  it("refuses a config that mixes public with a permission", () => {
    const { createAction } = setup();
    const config = {
      name: "oops",
      input: z.object({ workspaceId: z.string() }),
      public: true as const,
      permission: "task.delete" as const,
      workspaceId: (input: { workspaceId: string }) => input.workspaceId,
      handler: () => Promise.resolve(null),
    };

    // @ts-expect-error -- the access modes are mutually exclusive in the types as well.
    expect(() => createAction(config)).toThrow(/exactly one/);
  });
});
