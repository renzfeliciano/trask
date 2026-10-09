import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3100",
  DATABASE_URL: "postgres://trask_app:pw@localhost:5433/trask_test",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  NEXT_RUNTIME: "nodejs",
  NEXT_PHASE: "phase-production-server",
} as const;

// getEnv() memoizes at module level, so every test loads fresh copies of the modules.
async function loadRegister() {
  vi.resetModules();
  return (await import("@/instrumentation")).register;
}

describe("register (server start-up check)", () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(validEnv)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes with a complete environment", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const register = await loadRegister();

    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits with code 1 without DATABASE_URL, naming the variable and no value", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENCRYPTION_KEY", "not-base64-SuperSecret123!");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const register = await loadRegister();

    await register();

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    const printed = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toMatch(/Invalid environment: .*DATABASE_URL/);
    expect(printed).not.toContain("SuperSecret123");
  });

  it("skips validation during `next build`, which runs without secrets", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const register = await loadRegister();

    await register();

    expect(exit).not.toHaveBeenCalled();
  });

  it("skips validation outside the Node runtime", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const register = await loadRegister();

    await register();

    expect(exit).not.toHaveBeenCalled();
  });
});
