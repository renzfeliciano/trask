import { pingDatabase } from "@/server/health/repository";
import { checkHealth } from "@/server/health/service";

const queryRaw = vi.fn();
const warn = vi.fn();
vi.mock("@/server/adapters/pino-logger", () => ({ getLogger: () => ({ warn }) }));
vi.mock("@/db/client", () => ({ getDb: () => ({ $queryRaw: queryRaw }) }));

afterEach(() => {
  queryRaw.mockReset();
  warn.mockReset();
  vi.useRealTimers();
});

describe("pingDatabase", () => {
  it("is true when SELECT 1 succeeds", async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    await expect(pingDatabase(2000)).resolves.toBe(true);
  });

  it("is false, not a throw, when the query fails", async () => {
    queryRaw.mockRejectedValue(new Error("connection refused"));
    await expect(pingDatabase(2000)).resolves.toBe(false);
  });

  it("is false, not a throw, when the client cannot be built", async () => {
    queryRaw.mockImplementation(() => {
      throw new Error("Invalid environment: DATABASE_URL (invalid_format)");
    });
    await expect(pingDatabase(2000)).resolves.toBe(false);
  });

  it("is false when the query outlives the timeout", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const result = pingDatabase(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe(false);
  });
});

describe("checkHealth", () => {
  it("reports ok or degraded from the database ping", async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    await expect(checkHealth()).resolves.toBe("ok");
    queryRaw.mockRejectedValueOnce(new Error("down"));
    await expect(checkHealth()).resolves.toBe("degraded");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
