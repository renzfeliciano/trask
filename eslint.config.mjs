import { fixupConfigRules } from "@eslint/compat";
import boundaries from "eslint-plugin-boundaries";
import security from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

// --- Architecture boundaries -------------------------------------------------------------------------------
// Elements are classified by the first matching descriptor, so specific paths come before their parents.
// Patterns are matched against the full path from the repo root (partialMatch: false).
const boundaryElements = [
  { type: "server-errors", pattern: "src/server/errors", partialMatch: false },
  { type: "server-authz", pattern: "src/server/authz", partialMatch: false },
  // One element per server module, so cross-module imports are checked while same-module ones are internal.
  { type: "server", pattern: "src/server/*", capture: ["module"], partialMatch: false },
  { type: "db", pattern: "src/db", partialMatch: false },
  { type: "config", pattern: "src/config", partialMatch: false },
  { type: "lib", pattern: "src/lib", partialMatch: false },
  { type: "components-ui", pattern: "src/components", partialMatch: false },
  {
    type: "feature-actions",
    pattern: "src/features/*/actions",
    capture: ["feature"],
    partialMatch: false,
  },
  {
    type: "feature-client",
    pattern: [
      "src/features/*/components",
      "src/features/*/hooks",
      "src/features/*/schemas",
      "src/features/*/types",
    ],
    capture: ["feature"],
    partialMatch: false,
  },
  { type: "app", pattern: "src/app", partialMatch: false },
];

// schemas/ and types/ are the only feature-client folders that actions may import.
const boundaryFiles = [
  { category: "feature-contract", pattern: "src/features/*/{schemas,types}/**/*" },
  // Next.js 16 proxy (formerly middleware) is a single file next to app/, so it is a file category, not an element.
  { category: "app-entry", pattern: "src/proxy.ts" },
  // Repositories live inside server modules; the category lets one policy target them specifically.
  { category: "repository", pattern: "src/server/**/*repository.ts" },
];

const el = (...types) => ({ element: { type: types } });
const SERVER = ["server", "server-errors", "server-authz"];
const sameFeature = (type) => ({
  element: { type, captured: { feature: "{{ from.element.captured.feature }}" } },
});

// Default is disallow and the last matching policy wins, so each policy below only lists what is permitted.
const boundaryPolicies = [
  { from: el("components-ui"), allow: { to: el("lib") } },
  { from: el("lib"), allow: { to: el("lib") } },
  { from: el("config"), allow: { to: el("lib") } },
  {
    from: el("feature-client"),
    allow: {
      to: [
        el("components-ui", "lib"),
        sameFeature("feature-client"),
        sameFeature("feature-actions"),
      ],
    },
  },
  {
    from: el("feature-actions"),
    allow: {
      to: [
        el(...SERVER, "lib", "config"),
        sameFeature("feature-actions"),
        { ...sameFeature("feature-client"), file: { categories: "feature-contract" } },
      ],
    },
  },
  ...[el("app"), { file: { categories: "app-entry" } }].map((from) => ({
    from,
    allow: {
      to: el("feature-client", "feature-actions", "components-ui", "lib", "config", ...SERVER),
    },
  })),
  // Repositories are the only server code that may reach the db; services reach it through them.
  { from: el(...SERVER), allow: { to: el(...SERVER, "lib", "config") } },
  // Only server code may use repositories (matrix: the app and actions reach the "server" row, not repositories).
  {
    from: [el("app"), { file: { categories: "app-entry" } }, el("feature-actions")],
    disallow: { to: { file: { categories: "repository" } } },
  },
  // Narrows repositories (also "server" elements) to the matrix row: later policies win, so this runs after the one above.
  {
    from: { file: { categories: "repository" } },
    disallow: { to: el("server", "config") },
    allow: { to: el("db", "server-errors", "server-authz", "lib") },
  },
  { from: el("db"), allow: { to: el("config", "lib") } },
];

const eslintConfig = defineConfig([
  // eslint-config-next 16.3.x predates ESLint 10; the shim restores the context API its plugins use.
  // Remove once eslint-config-next 16.4+ is installed (it ships its own shim).
  ...fixupConfigRules([...nextVitals, ...nextTs]),
  {
    files: ["**/*.{ts,tsx,mts}"],
    // fixupConfigRules is cached per plugin object, so this reuses the plugin instance eslint-config-next registered.
    extends: fixupConfigRules(tseslint.configs.strictTypeChecked),
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  // Plain JS/MJS files (config files) have no tsconfig program, so type-aware rules are switched off for them.
  { files: ["**/*.{js,mjs,cjs}"], extends: [tseslint.configs.disableTypeChecked] },
  security.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": boundaryElements,
      "boundaries/files": boundaryFiles,
      // Added after eslint-config-next's node/typescript resolvers; resolves "@/*" even for files not yet written.
      "import/resolver": { "./eslint-alias-resolver.cjs": {} },
    },
    rules: {
      "boundaries/dependencies": ["error", { default: "disallow", policies: boundaryPolicies }],
    },
  },
  // --- Security and domain bans ---------------------------------------------------------------------------
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
      "no-restricted-properties": [
        "error",
        {
          property: "$queryRawUnsafe",
          message:
            "Use parameterized $queryRaw tagged templates; $queryRawUnsafe invites SQL injection.",
        },
        {
          property: "$executeRawUnsafe",
          message:
            "Use parameterized $executeRaw tagged templates; $executeRawUnsafe invites SQL injection.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: ["child_process", "node:child_process"].map((name) => ({
            name,
            message: "Spawning processes from application code is banned.",
          })),
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "BinaryExpression[operator=/^[!=]==?$/] > MemberExpression[property.name='role']",
          message: "Compare roles with atLeast() from @/server/authz/roles.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  prettier,
]);

export default eslintConfig;
