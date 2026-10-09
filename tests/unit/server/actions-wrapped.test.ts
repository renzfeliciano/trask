/* eslint-disable security/detect-non-literal-fs-filename -- paths come from fast-glob over this repository */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { findUnwrappedExports, isAction } from "@/server/actions/create-action";
import * as fixture from "../../fixtures/actions/mixed";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * True when the file's directive prologue (the leading string-literal statements, before any other code) contains
 * "use server". Parsed with the TypeScript compiler, so a "use server" string elsewhere in the file does not count.
 */
function hasUseServerDirective(fileName: string, source: string): boolean {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false);
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use server") return true;
  }
  return false;
}

/** Repo-relative paths of the "use server" modules matched by `patterns`. */
async function findUseServerFiles(patterns: string[], ignore: string[] = []): Promise<string[]> {
  const files = await fg(patterns, { cwd: repoRoot, ignore });
  const matches: string[] = [];
  for (const file of files.sort()) {
    if (hasUseServerDirective(file, await readFile(path.join(repoRoot, file), "utf8")))
      matches.push(file);
  }
  return matches;
}

async function unwrappedExportsOf(files: string[]) {
  const offenders: { file: string; unwrapped: string[] }[] = [];
  for (const file of files) {
    const mod = (await import(path.join(repoRoot, file))) as Record<string, unknown>;
    const unwrapped = findUnwrappedExports(mod);
    if (unwrapped.length > 0) offenders.push({ file, unwrapped });
  }
  return offenders;
}

describe("every exported Server Action is wrapped by createAction", () => {
  it("flags raw exported functions and ignores non-function exports", () => {
    expect(typeof fixture.LIMIT).toBe("number");
    expect(isAction(fixture.wrappedAction)).toBe(true);
    expect(isAction(fixture.rawExport)).toBe(false);
    expect(Object.keys(fixture.wrappedAction)).toEqual([]);
    expect(findUnwrappedExports(fixture)).toEqual(["rawExport"]);
  });

  it("keeps the brand off the function object, so it cannot be read or copied", () => {
    expect(Reflect.ownKeys(fixture.wrappedAction).filter((key) => typeof key === "symbol")).toEqual(
      [],
    );
    const forged = Object.defineProperties(
      (input: unknown) => Promise.resolve(input),
      Object.getOwnPropertyDescriptors(fixture.wrappedAction),
    );
    expect(isAction(forged)).toBe(false);
  });

  it("detects only real file-level directives", () => {
    expect(hasUseServerDirective("a.ts", '"use server";\nexport const x = 1;\n')).toBe(true);
    expect(hasUseServerDirective("a.ts", "// note\n'use strict';\n'use server';\n")).toBe(true);
    expect(hasUseServerDirective("a.ts", 'import "x";\n"use server";\n')).toBe(false);
    expect(hasUseServerDirective("a.ts", 'export const x = "use server";\n')).toBe(false);
    expect(hasUseServerDirective("a.ts", 'export async function f() {\n  "use server";\n}\n')).toBe(
      false,
    );
  });

  it('finds a raw export in a "use server" file outside src/features and ignores non-directives', async () => {
    const files = await findUseServerFiles(["tests/fixtures/use-server/**/*.{ts,tsx}"]);
    expect(files).toEqual(["tests/fixtures/use-server/lib/raw-action.ts"]);
    expect(await unwrappedExportsOf(files)).toEqual([
      { file: "tests/fixtures/use-server/lib/raw-action.ts", unwrapped: ["rawExport"] },
    ]);
  });

  it('finds no unwrapped export in any "use server" file under src/', async () => {
    const files = await findUseServerFiles(["src/**/*.{ts,tsx}"], ["src/generated/**"]);
    expect(await unwrappedExportsOf(files)).toEqual([]);
  });
});
