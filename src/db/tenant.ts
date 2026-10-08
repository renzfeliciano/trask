import "server-only";
import { getDb } from "./client";

/** Who the database acts for. `userId` must come from the verified session, never from request input. */
export interface TenantContext {
  userId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extendForUser(userId: string) {
  const db = getDb();
  return db.$extends({
    name: "tenant",
    query: {
      // Top-level $allOperations covers every model operation and the raw queries ($queryRaw, $executeRaw).
      async $allOperations({ args, query }) {
        // Prisma's documented RLS pattern: a batch transaction runs both statements on one connection, in order.
        // is_local = true scopes app.user_id to this transaction, so it is gone once the connection returns to the pool.
        const results: unknown[] = await db.$transaction([
          db.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
          query(args),
        ]);
        return results[1];
      },
    },
  });
}

/**
 * The app client scoped to one user: row-level security shows and accepts only rows of workspaces that user belongs to.
 *
 * Each operation runs in its own short transaction. `$transaction` is left out because an operation inside a caller's
 * transaction would not carry the tenant setting (it would see no rows); add a tenant-aware transaction helper when a
 * use case needs several statements to commit together. The omission is type-level only: the runtime object still has
 * these methods, so a cast can reach them.
 */
export type TenantDb = Omit<
  ReturnType<typeof extendForUser>,
  "$transaction" | "$connect" | "$disconnect"
>;

export function withTenant(ctx: TenantContext): TenantDb {
  // The id is sent as a bind parameter, but a malformed one would fail the uuid cast inside every policy; reject it here.
  if (!UUID_PATTERN.test(ctx.userId)) throw new Error("withTenant: ctx.userId must be a UUID");
  return extendForUser(ctx.userId);
}
