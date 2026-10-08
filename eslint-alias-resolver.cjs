// import/resolver plugin used by eslint-plugin-boundaries to map the "@/*" alias to "src/*".
// Unlike the TypeScript resolver it still answers for modules that are not on disk yet, so a boundary
// violation is reported even when the import target has not been written (the TypeScript compiler
// reports missing modules separately). Real files win, so extensions and index files resolve as usual.
/* eslint-disable @typescript-eslint/no-require-imports, security/detect-non-literal-fs-filename -- CommonJS plugin loaded by eslint-module-utils; paths are built from a fixed root. */
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "src");
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

exports.interfaceVersion = 2;

exports.resolve = (source) => {
  if (!source.startsWith("@/")) return { found: false };
  const target = path.join(SRC, source.slice(2));
  for (const suffix of SUFFIXES) {
    const candidate = target + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { found: true, path: candidate };
    }
  }
  return { found: true, path: `${target}.ts` };
};
