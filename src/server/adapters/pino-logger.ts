import "server-only";
import pino from "pino";
import type { Env } from "@/config/env";
import { getEnv } from "@/config/env";
import type { Logger } from "@/server/ports/logger";

const CENSOR = "[REDACTED]";

const SENSITIVE_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "email",
  "cookie",
  "authorization",
] as const;

// fast-redact wildcards match exactly one level, so each key is covered at the top level, one level down
// (user.email) and inside a headers object at both depths (headers.cookie, req.headers.cookie).
const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `headers.${key}`,
  `*.headers.${key}`,
]);

export interface CreateLoggerOptions {
  level: Env["LOG_LEVEL"];
  destination?: pino.DestinationStream;
}

// pino's own Logger already satisfies the port, but wrapping keeps pino types from leaking past this file.
function wrap(instance: pino.Logger): Logger {
  return {
    debug: (obj, msg) => {
      instance.debug(obj, msg);
    },
    info: (obj, msg) => {
      instance.info(obj, msg);
    },
    warn: (obj, msg) => {
      instance.warn(obj, msg);
    },
    error: (obj, msg) => {
      instance.error(obj, msg);
    },
    child: (bindings) => wrap(instance.child(bindings)),
  };
}

export function createLogger({ level, destination }: CreateLoggerOptions): Logger {
  const instance = pino({ level, redact: { paths: REDACT_PATHS, censor: CENSOR } }, destination);
  return wrap(instance);
}

let cached: Logger | undefined;

/** The process-wide logger, built from LOG_LEVEL on first call so importing this module needs no env. */
export function getLogger(): Logger {
  cached ??= createLogger({ level: getEnv().LOG_LEVEL });
  return cached;
}
