import "server-only";
import { withTenant, type TenantContext } from "@/db/tenant";
import type { Role } from "@/server/authz/roles";

/** Creates a workspace with the current user as its OWNER (the database function picks the owner, not the caller). */
export async function createWorkspace(
  ctx: TenantContext,
  input: { name: string; slug: string },
): Promise<{ id: string }> {
  const rows = await withTenant(ctx).$queryRaw<{ id: string }[]>`
    SELECT app.create_workspace(${input.name}, ${input.slug}) AS id`;
  const row = rows[0];
  if (!row) throw new Error("app.create_workspace returned no row");
  return { id: row.id };
}

/** The current user's role in a workspace, or null when they are not a member (row-level security hides it). */
export async function findMembershipRole(
  ctx: TenantContext,
  workspaceId: string,
): Promise<Role | null> {
  const membership = await withTenant(ctx).workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: ctx.userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}
