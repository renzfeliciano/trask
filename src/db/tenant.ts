import "server-only";
import { getDb } from "./client";

/** Who the database acts for. `userId` must come from the verified session, never from request input. */
export interface TenantContext {
  userId: string;
}

/**
 * Who the database acts for and the one workspace it acts in: the `WorkspaceCtx` that createAction hands a handler
 * after checking the user's role in `workspaceId`. Never build it from request input.
 */
export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extendForContext(userId: string, workspaceId: string | null) {
  const db = getDb();
  return db.$extends({
    name: "tenant",
    query: {
      // Top-level $allOperations covers every model operation and the raw queries ($queryRaw, $executeRaw).
      async $allOperations({ args, query }) {
        // Prisma's documented RLS pattern: a batch transaction runs both statements on one connection, in order.
        // is_local = true scopes the settings to this transaction, so they are gone once the connection returns to the
        // pool. An empty app.workspace_id reads as NULL in app.current_workspace_id() (no workspace scope).
        const results: unknown[] = await db.$transaction([
          db.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE), set_config('app.workspace_id', ${workspaceId ?? ""}, TRUE)`,
          query(args),
        ]);
        return results[1];
      },
    },
  });
}

/**
 * A client scoped to one user, or to one user in one workspace (see withTenant and withWorkspace).
 *
 * Each operation runs in its own short transaction. `$transaction` is left out because an operation inside a caller's
 * transaction would not carry the tenant settings (it would see no rows); add a tenant-aware transaction helper when a
 * use case needs several statements to commit together. The omission is type-level only: the runtime object still has
 * these methods, so a cast can reach them.
 */
export type TenantDb = Omit<
  ReturnType<typeof extendForContext>,
  "$transaction" | "$connect" | "$disconnect"
>;

function assertUuid(value: string, name: string): void {
  // Ids are sent as bind parameters, but a malformed one would fail the uuid cast inside every policy; reject it here.
  if (!UUID_PATTERN.test(value)) throw new Error(`${name} must be a UUID`);
}

/**
 * The app client scoped to one user across ALL of their workspaces: row-level security shows and accepts rows of every
 * workspace the user belongs to. Use it only for reads that span workspaces (the user's workspaces and memberships)
 * and for app.create_workspace. Workspace-owned data goes through withWorkspace.
 */
export function withTenant(ctx: TenantContext): TenantDb {
  assertUuid(ctx.userId, "withTenant: ctx.userId");
  return extendForContext(ctx.userId, null);
}

/**
 * The app client scoped to one user in ONE workspace: row-level security shows and accepts only rows of
 * `ctx.workspaceId`, and only while the user is a member of it.
 *
 * Repositories for workspace-owned data (boards, columns, tasks, labels, comments, attachments, activity, members)
 * MUST use this, with the WorkspaceCtx that createAction built after authorizing the user's role in that workspace.
 * createAction checks the role in one workspace; this makes the database refuse every row of any other workspace,
 * so an id from another of the user's workspaces (where their role may be lower) cannot be read or written.
 */
export function withWorkspace(ctx: WorkspaceContext): TenantDb {
  assertUuid(ctx.userId, "withWorkspace: ctx.userId");
  assertUuid(ctx.workspaceId, "withWorkspace: ctx.workspaceId");
  return extendForContext(ctx.userId, ctx.workspaceId.toLowerCase());
}
