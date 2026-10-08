// Verifies that DATABASE_URL connects as a role row-level security applies to: not a superuser, no BYPASSRLS, no
// owner privileges on application tables or functions (also not through role membership), not a member of trask_migrator.
// Usage: DATABASE_URL=<trask_app URL> pnpm tsx scripts/verify-db-roles.ts   (exit code 1 on any failure)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { inspectCurrentRole, rlsExemptions } from "./rls-exemption";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const role = await inspectCurrentRole(db);
  console.info(
    `${role.name}: rolbypassrls=${String(role.rolbypassrls)}, owner=${String(role.owner)}`,
  );
  const reasons = rlsExemptions(role);
  for (const reason of reasons) console.error(`Row-level security does not apply: ${reason}.`);
  if (reasons.length > 0) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
