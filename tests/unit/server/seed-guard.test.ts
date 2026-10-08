import { describe, expect, it } from "vitest";
import { assertSeedAllowed } from "@/server/seed/guard";

describe("assertSeedAllowed", () => {
  it("refuses to seed production", () => {
    expect(() => {
      assertSeedAllowed("production");
    }).toThrow(/production/);
  });

  it.each(["development", "test"])("allows %s", (nodeEnv) => {
    expect(() => {
      assertSeedAllowed(nodeEnv);
    }).not.toThrow();
  });

  it.each(["", "staging", "Development"])("refuses an unrecognized environment %j", (nodeEnv) => {
    expect(() => {
      assertSeedAllowed(nodeEnv);
    }).toThrow(/NODE_ENV/);
  });
});
