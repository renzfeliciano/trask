// Fails when the browser bundle (.next/static/**) contains a server secret value or the name of a server secret.
// Usage (after `pnpm build`): pnpm check:bundle   (exit code 1 on any leak, 2 when there is nothing to scan)
//
// Secret values come from process.env only: every variable that is not NEXT_PUBLIC_*, is not on the non-secret list
// below and holds 8 or more characters. CI exports the .env.test values before running this (see Task 15); locally,
// export them (or source your .env) in the same shell. Values are never printed, only the file path and the reason.
import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface BundleFile {
  path: string;
  content: string;
}
export interface Leak {
  path: string;
  reason: string;
}

const MIN_SECRET_LENGTH = 8;

// Names that must never appear in client code, whatever the environment holds.
const SECRET_NAMES = ["DATABASE_URL", "MIGRATION_DATABASE_URL", "ENCRYPTION_KEY"] as const;

// Exact names (lowercase) whose values are public or ambient: the build inlines NODE_ENV ("production") and APP_URL is
// the public origin, LOG_LEVEL is a word; the rest are OS/shell/CI variables that are not application secrets but whose
// values (paths, "https://github.com", "C.UTF-8") legitimately occur in bundled code.
const NON_SECRET_KEYS = new Set([
  "node_env",
  "log_level",
  "app_url",
  "ci",
  "path",
  "pwd",
  "oldpwd",
  "home",
  "userprofile",
  "shell",
  "term",
  "lang",
  "tmpdir",
  "temp",
  "tmp",
  "user",
  "username",
  "logname",
  "hostname",
  "computername",
  "os",
  "comspec",
  "pathext",
  "systemroot",
  "windir",
  "appdata",
  "localappdata",
  "programfiles",
  "programdata",
  "nvm_dir",
  "editor",
  "colorterm",
]);
// Ambient families injected by tooling: GitHub Actions, runners, npm/pnpm lifecycle, Next.js flags (NEXT_PUBLIC_* included).
const NON_SECRET_PREFIXES = ["next_", "github_", "runner_", "npm_", "pnpm_", "lc_", "xdg_"];

const BINARY_EXTENSIONS = /\.(?:woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|ico|wasm)$/i;

const toPosix = (value: string): string => value.replaceAll("\\", "/");
const toLf = (value: string): string => value.replaceAll("\r\n", "\n");
const isIdentifierChar = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9_]/.test(char);

// True when `name` occurs as a whole identifier, so MIGRATION_DATABASE_URL is not also reported as DATABASE_URL.
function referencesName(content: string, name: string): boolean {
  for (let at = content.indexOf(name); at !== -1; at = content.indexOf(name, at + 1)) {
    if (!isIdentifierChar(content[at - 1]) && !isIdentifierChar(content[at + name.length]))
      return true;
  }
  return false;
}

export function collectSecretValues(env: Record<string, string | undefined>): string[] {
  const values = new Set<string>();
  for (const [key, value] of Object.entries(env)) {
    const lower = key.toLowerCase();
    if (value === undefined || value.length < MIN_SECRET_LENGTH) continue;
    if (
      NON_SECRET_KEYS.has(lower) ||
      NON_SECRET_PREFIXES.some((prefix) => lower.startsWith(prefix))
    )
      continue;
    values.add(value);
  }
  return [...values];
}

/** Pure scan: no I/O, so it is testable without a build. Reasons never contain a secret value. */
export function findLeaks(files: BundleFile[], secretValues: string[]): Leak[] {
  // A value can appear raw or JSON-escaped (inside a string literal or the RSC payload).
  const needles = secretValues
    .filter((value) => value.length > 0)
    .map((value) => toLf(value))
    .flatMap((value) => [value, JSON.stringify(value).slice(1, -1)]);
  const uniqueNeedles = [...new Set(needles)];
  const leaks: Leak[] = [];
  for (const file of files) {
    const path = toPosix(file.path);
    const content = toLf(file.content);
    if (uniqueNeedles.some((needle) => content.includes(needle))) {
      leaks.push({ path, reason: "contains the value of a server-only environment variable" });
    }
    for (const name of SECRET_NAMES) {
      if (referencesName(content, name))
        leaks.push({ path, reason: `references server-only variable name ${name}` });
    }
  }
  return leaks;
}

async function main(): Promise<number> {
  const paths = await fg(".next/static/**/*", { dot: true, onlyFiles: true, unique: true });
  const scannable = paths.map(toPosix).filter((path) => !BINARY_EXTENSIONS.test(path));
  if (scannable.length === 0) {
    console.error("No files under .next/static to scan. Run `pnpm build` first.");
    return 2;
  }
  const files = await Promise.all(
    // Paths come from the glob over .next/static, not from user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    scannable.map(async (path) => ({ path, content: await readFile(path, "utf8") })),
  );
  const secretValues = collectSecretValues(process.env);
  const leaks = findLeaks(files, secretValues);
  for (const leak of leaks) console.error(`LEAK ${leak.path}: ${leak.reason}`);
  if (leaks.length > 0) {
    console.error(
      `Client bundle check failed: ${String(leaks.length)} leak(s) in ${String(files.length)} files.`,
    );
    return 1;
  }
  console.info(
    `Client bundle clean: ${String(files.length)} files scanned against ${String(secretValues.length)} secret values and ${String(SECRET_NAMES.length)} names.`,
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
