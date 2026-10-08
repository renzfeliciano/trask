import { readFileSync } from "node:fs";
import { parseEnv as parseDotenv } from "node:util";
import { parseEnv } from "@/config/env";

const validSource = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3100",
  DATABASE_URL: "postgres://trask_app:pw@localhost:5433/trask_test",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};

function messageOf(source: Record<string, string | undefined>): string {
  try {
    parseEnv(source);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("accepts a complete valid environment", () => {
    const env = parseEnv(validSource);

    expect(env.ENCRYPTION_KEY).toBeInstanceOf(Buffer);
    expect(env.ENCRYPTION_KEY).toHaveLength(32);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL);
  });

  it("accepts the committed .env.test", () => {
    const fromFile = parseDotenv(readFileSync(".env.test", "utf8"));

    expect(() => parseEnv(fromFile)).not.toThrow();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({ ...validSource, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    const message = messageOf({ ...validSource, DATABASE_URL: "mysql://u:p@h/db" });

    expect(message).toContain("DATABASE_URL");
  });

  it("rejects an ENCRYPTION_KEY that is not 32 bytes", () => {
    const short = Buffer.alloc(16, 7).toString("base64");

    expect(() => parseEnv({ ...validSource, ENCRYPTION_KEY: short })).toThrow(/ENCRYPTION_KEY/);
  });

  it("rejects an ENCRYPTION_KEY that is not base64", () => {
    expect(() => parseEnv({ ...validSource, ENCRYPTION_KEY: "!".repeat(44) })).toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it("never includes secret values in the error", () => {
    const message = messageOf({
      ...validSource,
      DATABASE_URL: "postgres://u:SuperSecret123@h/db",
      APP_URL: "not a url",
    });

    expect(message).toContain("APP_URL");
    expect(message).not.toContain("SuperSecret123");
  });

  it("never includes a bad ENCRYPTION_KEY value in the error", () => {
    const message = messageOf({ ...validSource, ENCRYPTION_KEY: "TopSecretKeyValue" });

    expect(message).not.toContain("TopSecretKeyValue");
  });
});
