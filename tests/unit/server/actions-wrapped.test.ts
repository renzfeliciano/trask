import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { describe, expect, it } from "vitest";
import { findUnwrappedExports, isAction } from "@/server/actions/action-brand";
import * as fixture from "../../fixtures/actions/mixed";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("every exported Server Action is wrapped by createAction", () => {
  it("flags raw exported functions and ignores non-function exports", () => {
    expect(typeof fixture.LIMIT).toBe("number");
    expect(isAction(fixture.wrappedAction)).toBe(true);
    expect(isAction(fixture.rawExport)).toBe(false);
    expect(Object.keys(fixture.wrappedAction)).toEqual([]);
    expect(findUnwrappedExports(fixture)).toEqual(["rawExport"]);
  });

  it("finds no unwrapped export in any src/features/**/actions/*.ts file", async () => {
    const files = await fg("src/features/**/actions/*.ts", { cwd: repoRoot });
    const offenders: { file: string; unwrapped: string[] }[] = [];
    for (const file of files) {
      const mod = (await import(path.join(repoRoot, file))) as Record<string, unknown>;
      const unwrapped = findUnwrappedExports(mod);
      if (unwrapped.length > 0) offenders.push({ file, unwrapped });
    }
    expect(offenders).toEqual([]);
  });
});
