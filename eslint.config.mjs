import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // eslint-config-next 16.3.x predates ESLint 10; the shim restores the context API its plugins use.
  // Remove once eslint-config-next 16.4+ is installed (it ships its own shim).
  ...fixupConfigRules([...nextVitals, ...nextTs]),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
