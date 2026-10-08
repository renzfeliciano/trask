// Checks whether the connected role escapes row-level security. Shared by scripts/verify-db-roles.ts and the RLS tests.
import type { PrismaClient } from "@/generated/prisma/client";

export interface RoleRlsStatus {
  name: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  /** Has the privileges of the owner of an application table or app function (directly or through inherited membership). */
  owner: boolean;
  /** Member of trask_migrator in any way, so it could `SET ROLE trask_migrator` even without inheriting its privileges. */
  memberOfMigrator: boolean;
}

/**
 * Postgres exempts a role from (non-forced) RLS when it has the privileges of the table owner (has_privs_of_role),
 * which membership in the owning role grants. `pg_has_role(..., 'USAGE')` asks exactly that question.
 */
export async function inspectCurrentRole(db: PrismaClient): Promise<RoleRlsStatus> {
  const [role] = await db.$queryRaw<RoleRlsStatus[]>`
    SELECT r.rolname AS name, r.rolsuper, r.rolbypassrls,
           EXISTS (
             SELECT 1 FROM pg_class c
             WHERE c.relnamespace IN ('public'::regnamespace, to_regnamespace('app'))
               AND pg_has_role(r.oid, c.relowner, 'USAGE')
           ) OR EXISTS (
             SELECT 1 FROM pg_proc p
             WHERE p.pronamespace = to_regnamespace('app') AND pg_has_role(r.oid, p.proowner, 'USAGE')
           ) AS owner,
           coalesce(pg_has_role(r.oid, to_regrole('trask_migrator'), 'MEMBER'), false) AS "memberOfMigrator"
    FROM pg_roles r WHERE r.rolname = current_user`;
  if (!role) throw new Error("current_user has no pg_roles entry");
  return role;
}

/** Every reason the role escapes row-level security; empty when RLS applies to it. */
export function rlsExemptions(role: RoleRlsStatus): string[] {
  const reasons: string[] = [];
  if (role.rolsuper) reasons.push(`${role.name} is a superuser`);
  if (role.rolbypassrls) reasons.push(`${role.name} has BYPASSRLS`);
  if (role.owner) reasons.push(`${role.name} has the privileges of a table or function owner`);
  if (role.memberOfMigrator) reasons.push(`${role.name} is a member of trask_migrator`);
  return reasons;
}
