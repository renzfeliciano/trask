// import/resolver plugin used by eslint-plugin-boundaries to map the "@/*" alias to "src/*".
// Unlike the TypeScript resolver it still answers for modules that are not on disk yet, so a boundary
// violation is reported even when the import target has not been written (the TypeScript compiler
// reports missing modules separately). Real files win, so extensions and index files resolve as usual.
// Extensionless relative imports get the same treatment so ./service is classified before service.ts exists.
/* eslint-disable @typescript-eslint/no-require-imports, security/detect-non-literal-fs-filename -- CommonJS plugin loaded by eslint-module-utils; paths are built from a fixed root. */
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "src");
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

exports.interfaceVersion = 2;

function probe(target) {
  for (const suffix of SUFFIXES) {
    const candidate = target + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

exports.resolve = (source, file) => {
  let target;
  if (source.startsWith("@/")) {
    target = path.join(SRC, source.slice(2));
  } else if (source.startsWith(".") && path.extname(source) === "") {
    // Extensionless relative import of a file that may not exist yet; the node/typescript resolvers run first.
    target = path.resolve(path.dirname(file), source);
  } else {
    return { found: false };
  }
  return { found: true, path: probe(target) ?? `${target}.ts` };
};
