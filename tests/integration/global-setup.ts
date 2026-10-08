import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Applies all migrations once, as trask_migrator, before any integration test file runs. */
export default function setup(): void {
  if (existsSync(".env.test")) process.loadEnvFile(".env.test");
  try {
    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      // Prisma's progress output is only worth showing when the migration fails.
      stdio: "pipe",
      encoding: "utf8",
      // pnpm is a .cmd shim on Windows, which needs a shell to launch.
      shell: process.platform === "win32",
      env: { ...process.env, NODE_ENV: "test" },
    });
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    process.stderr.write(`${output.stdout ?? ""}${output.stderr ?? ""}`);
    throw new Error("prisma migrate deploy failed for the integration test database");
  }
}
