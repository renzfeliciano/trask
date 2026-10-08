import "server-only";
import { z } from "zod";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const ENCRYPTION_KEY_BYTES = 32;

const encryptionKey = z
  .string()
  .refine((value) => BASE64_PATTERN.test(value), { message: "must be base64" })
  .transform((value) => Buffer.from(value, "base64"))
  .refine((key) => key.length === ENCRYPTION_KEY_BYTES, {
    message: `must decode to ${String(ENCRYPTION_KEY_BYTES)} bytes`,
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_URL: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENCRYPTION_KEY: encryptionKey,
});

export type Env = z.output<typeof envSchema>;

/**
 * Validates an environment source. On failure the error names only the failing
 * variables and Zod issue codes, never their values, so it is safe to log.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"} (${issue.code})`,
  );
  throw new Error(`Invalid environment: ${issues.join(", ")}`);
}

let cached: Env | undefined;

/** The process environment, validated once and memoized. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
