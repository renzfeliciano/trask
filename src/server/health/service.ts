import "server-only";
import { getLogger } from "@/server/adapters/pino-logger";
import { pingDatabase } from "./repository";

const DATABASE_TIMEOUT_MS = 2000;

export type HealthStatus = "ok" | "degraded";

/** Overall health: "ok" when the database answers, otherwise "degraded". Details stay in the log, never the response. */
export async function checkHealth(): Promise<HealthStatus> {
  if (await pingDatabase(DATABASE_TIMEOUT_MS)) return "ok";
  getLogger().warn({ check: "database" }, "health check failed");
  return "degraded";
}
