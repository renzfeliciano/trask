/* eslint-disable security/detect-non-literal-fs-filename -- paths come from fast-glob over this repository */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

// Files allowed to skip the guard, each with the reason. Empty: every server and db module imports it today, even
// type-only ports, so moving a runtime value into one of them later cannot slip into a client bundle unnoticed.
const EXCEPTIONS: Readonly<Record<string, string>> = {};

/** True when the first statement (comments aside) is the side-effect import `import "server-only"`. */
function startsWithServerOnly(fileName: string, source: string): boolean {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  const first = file.statements[0];
  return (
    first !== undefined &&
    ts.isImportDeclaration(first) &&
    first.importClause === undefined &&
    ts.isStringLiteral(first.moduleSpecifier) &&
    first.moduleSpecifier.text === "server-only"
  );
}

describe('every server and db module starts with import "server-only"', () => {
  it("recognizes only a leading side-effect import", () => {
    expect(startsWithServerOnly("a.ts", '// note\nimport "server-only";\nexport {};\n')).toBe(true);
    expect(startsWithServerOnly("a.ts", 'import { z } from "zod";\nimport "server-only";\n')).toBe(
      false,
    );
    expect(startsWithServerOnly("a.ts", 'import x from "server-only";\n')).toBe(false);
    expect(startsWithServerOnly("a.ts", '// import "server-only";\nexport {};\n')).toBe(false);
  });

  it("holds for every file under src/server and src/db", async () => {
    const files = await fg(["src/server/**/*.{ts,tsx}", "src/db/**/*.{ts,tsx}"], {
      cwd: repoRoot,
    });
    expect(files.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of files.sort()) {
      if (Object.hasOwn(EXCEPTIONS, file)) continue;
      const source = await readFile(path.join(repoRoot, file), "utf8");
      if (!startsWithServerOnly(file, source)) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});
