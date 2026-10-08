import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type User } from "@/generated/prisma/client";

function clientFor(variable: string, connectionString: string | undefined): PrismaClient {
  if (!connectionString)
    throw new Error(`${variable} is not set (tests/integration/setup.ts loads .env.test)`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The owner role (trask_migrator). Not subject to the app role's grants; use it to arrange and inspect data. */
export const adminDb = clientFor("MIGRATION_DATABASE_URL", process.env.MIGRATION_DATABASE_URL);

/** The runtime role (trask_app): DML grants only, row-level security applies. Use it to test what the app can do. */
export const appDb = clientFor("DATABASE_URL", process.env.DATABASE_URL);

/** Empties every application table. User and Workspace reach all other tables through their foreign keys. */
export async function resetDb(): Promise<void> {
  await adminDb.$executeRaw`TRUNCATE TABLE "AuditEvent", "User", "Workspace" CASCADE`;
}

export async function createUser(overrides: Partial<Omit<User, "id">> = {}): Promise<User> {
  const unique = randomUUID();
  return adminDb.user.create({
    data: { email: `user-${unique}@example.test`, name: "Test User", ...overrides },
  });
}
