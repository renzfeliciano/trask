import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDb } from "@/db/client";
import { PrismaClient, type User } from "@/generated/prisma/client";

function clientFor(variable: string, connectionString: string | undefined): PrismaClient {
  if (!connectionString)
    throw new Error(`${variable} is not set (tests/integration/setup.ts loads .env.test)`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The owner role (trask_migrator). Not subject to the app role's grants; use it to arrange and inspect data. */
export const adminDb = clientFor("MIGRATION_DATABASE_URL", process.env.MIGRATION_DATABASE_URL);

/**
 * The runtime role (trask_app): DML grants only, row-level security applies. It is the application's own client
 * (same connection pool that `withTenant` wraps), so tests see exactly what a repository would.
 */
export const appDb = getDb();

/** Empties every table in schema public except Prisma's migration history, whatever migrations have added. */
export async function resetDb(): Promise<void> {
  await adminDb.$executeRaw`
    DO $$
    BEGIN
      EXECUTE (
        SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ')
          || ' RESTART IDENTITY CASCADE'
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      );
    END
    $$`;
}

export async function createUser(overrides: Partial<Omit<User, "id">> = {}): Promise<User> {
  const unique = randomUUID();
  return adminDb.user.create({
    data: { email: `user-${unique}@example.test`, name: "Test User", ...overrides },
  });
}
