// Verifies that DATABASE_URL connects as a role row-level security applies to: not a superuser, no BYPASSRLS,
// and owner of no application table or function (owners skip RLS unless it is FORCEd).
// Usage: DATABASE_URL=<trask_app URL> pnpm tsx scripts/verify-db-roles.ts   (exit code 1 on any failure)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const [role] = await db.$queryRaw<
    { name: string; rolsuper: boolean; rolbypassrls: boolean; owner: boolean }[]
  >`
    SELECT r.rolname AS name, r.rolsuper, r.rolbypassrls,
           EXISTS (
             SELECT 1 FROM pg_class c
             WHERE c.relowner = r.oid AND c.relnamespace IN ('public'::regnamespace, to_regnamespace('app'))
           ) OR EXISTS (
             SELECT 1 FROM pg_proc p WHERE p.proowner = r.oid AND p.pronamespace = to_regnamespace('app')
           ) AS owner
    FROM pg_roles r WHERE r.rolname = current_user`;
  if (!role) throw new Error("current_user has no pg_roles entry");

  console.info(
    `${role.name}: rolbypassrls=${String(role.rolbypassrls)}, owner=${String(role.owner)}`,
  );
  if (role.rolsuper)
    console.error(`${role.name} is a superuser, which bypasses row-level security.`);
  if (role.rolsuper || role.rolbypassrls || role.owner) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
