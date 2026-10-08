import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

function createClient(): PrismaClient {
  // node-postgres over TCP, as the least-privileged trask_app role (the pooled endpoint on Neon).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
}

// Hot reloads re-evaluate this module in development; keeping the client on globalThis preserves one connection pool per process.
const globalForDb = globalThis as typeof globalThis & { traskDb?: PrismaClient };

/**
 * The application's Prisma client, created on first call and memoized. Reading the environment here (not at import)
 * means importing a module that uses the db never requires configuration, which keeps unit tests and `next build` free of it.
 */
export function getDb(): PrismaClient {
  globalForDb.traskDb ??= createClient();
  return globalForDb.traskDb;
}
