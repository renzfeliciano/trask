import { getEnv } from "@/config/env";

/**
 * Stops the process with exit code 1 when the environment is invalid. The message names the failing variables and
 * never their values (src/config/env.ts), so it is safe to print. Not the logger: building it needs a valid env too.
 */
export function exitOnInvalidEnv(): void {
  try {
    getEnv();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Invalid environment"}\n`);
    process.exit(1);
  }
}
