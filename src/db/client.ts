import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

function createClient(): PrismaClient {
  // node-postgres over TCP, as the least-privileged trask_app role (the pooled endpoint on Neon).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
}

// Hot reloads re-evaluate this module in development; keep one client (and one connection pool) per process.
const globalForDb = globalThis as typeof globalThis & { traskDb?: PrismaClient };

export const db = globalForDb.traskDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.traskDb = db;
