import { pingDatabase } from "@/server/health/repository";

describe("health repository", () => {
  it("reaches the real database as the app role", async () => {
    await expect(pingDatabase(2000)).resolves.toBe(true);
  });
});
