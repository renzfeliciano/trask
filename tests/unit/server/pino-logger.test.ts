import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/server/adapters/pino-logger";

function captureLogger(level: "debug" | "info" | "warn" | "error" = "debug") {
  const lines: string[] = [];
  const destination = {
    write(chunk: string) {
      lines.push(chunk);
    },
  };
  const logger = createLogger({ level, destination });
  const parsed = (): Record<string, unknown>[] =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, parsed };
}

describe("createLogger redaction", () => {
  it("redacts secrets at the top level and one level down, and keeps safe fields", () => {
    const { logger, parsed } = captureLogger();
    logger.info(
      {
        password: "p",
        token: "t",
        user: { email: "a@b.c", accessToken: "x" },
        headers: { cookie: "c", authorization: "Bearer y" },
        userId: "u1",
      },
      "request handled",
    );

    const [entry] = parsed();
    expect(entry).toMatchObject({
      msg: "request handled",
      password: "[REDACTED]",
      token: "[REDACTED]",
      user: { email: "[REDACTED]", accessToken: "[REDACTED]" },
      headers: { cookie: "[REDACTED]", authorization: "[REDACTED]" },
      userId: "u1",
    });
  });

  it("redacts every listed key at the top level and one level nested", () => {
    const keys = [
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "secret",
      "email",
      "cookie",
      "authorization",
    ];
    const { logger, parsed } = captureLogger();
    const flat = Object.fromEntries(keys.map((key) => [key, "sensitive"]));
    logger.info({ ...flat, nested: flat }, "keys");

    const [entry] = parsed();
    for (const key of keys) {
      expect(entry).toHaveProperty(key, "[REDACTED]");
      expect(entry).toHaveProperty(["nested", key], "[REDACTED]");
    }
    expect(JSON.stringify(entry)).not.toContain("sensitive");
  });

  it("redacts request headers one level inside a request object", () => {
    const { logger, parsed } = captureLogger();
    logger.warn({ req: { headers: { cookie: "c", authorization: "a" }, method: "GET" } }, "req");

    const [entry] = parsed();
    expect(entry).toMatchObject({
      req: { headers: { cookie: "[REDACTED]", authorization: "[REDACTED]" }, method: "GET" },
    });
  });
});

describe("createLogger behaviour", () => {
  it("drops entries below the configured level", () => {
    const { logger, parsed } = captureLogger("warn");
    logger.debug({}, "debug");
    logger.info({}, "info");
    logger.warn({}, "warn");
    logger.error({}, "error");

    expect(parsed().map((entry) => entry["msg"])).toEqual(["warn", "error"]);
  });

  it("child loggers carry their bindings and still redact", () => {
    const { logger, parsed } = captureLogger();
    logger.child({ requestId: "r1", token: "t" }).info({ userId: "u1" }, "child");

    const [entry] = parsed();
    expect(entry).toMatchObject({ requestId: "r1", token: "[REDACTED]", userId: "u1" });
  });
});

describe("getLogger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not need environment variables until first called, then memoizes", async () => {
    for (const key of ["NODE_ENV", "APP_URL", "DATABASE_URL", "LOG_LEVEL", "ENCRYPTION_KEY"]) {
      vi.stubEnv(key, undefined);
    }
    vi.resetModules();
    const bare = await import("@/server/adapters/pino-logger");
    expect(() => bare.getLogger()).toThrow(/Invalid environment/);

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_URL", "http://localhost:3100");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5433/db");
    vi.stubEnv("LOG_LEVEL", "error");
    vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.resetModules();
    const configured = await import("@/server/adapters/pino-logger");
    expect(configured.getLogger()).toBe(configured.getLogger());
  });
});
