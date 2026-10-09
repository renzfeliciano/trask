// Fails when the browser bundle (.next/static/**) contains a server secret value or the name of a server secret, or
// when the environment holds a NEXT_PUBLIC_* variable that is not on PUBLIC_ENV_ALLOWLIST (Next would inline it).
// Library module (pure findLeaks/collectSecretValues/findDisallowedPublicKeys plus runCheck); the executable entry is
// check-client-bundle.cli.ts.
// Usage (after `pnpm build`): pnpm check:bundle   (exit code 1 on any leak, 2 when there is nothing to scan)
//
// Secret values come from process.env only: every variable that is not an allowlisted NEXT_PUBLIC_* one, is not on the
// non-secret list below and holds 8 or more characters. CI exports the .env.test values before running this (see Task 15); locally,
// export them (or source your .env) in the same shell. Values are never printed, only the file path and the reason.
import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

// Exact names (lowercase) whose values are public or ambient: the build inlines NODE_ENV ("production"), APP_URL is
// the public origin and LOG_LEVEL is a plain word; the rest are OS/shell/CI variables that are not application secrets
// but whose values (paths, "https://github.com") can legitimately occur in bundled code.
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
  "github_server_url",
  "github_api_url",
  "github_graphql_url",
  "github_repository",
  "github_workspace",
]);
// Next inlines every NEXT_PUBLIC_* variable into the browser bundle, so each one must be reviewed and listed here by exact
// name. Any other NEXT_PUBLIC_* key in the environment fails the check (spec §6): renaming DATABASE_URL to
// NEXT_PUBLIC_DATABASE_URL must not publish it. Empty until a feature needs a public variable.
export const PUBLIC_ENV_ALLOWLIST: ReadonlySet<string> = new Set<string>([]);
// Matched case-insensitively, so a differently cased key fails closed instead of slipping past the allowlist.
const PUBLIC_PREFIX = "next_public_";
// Deny-override: a key that looks like a credential is always scanned, even if an exemption above would match it.
const CREDENTIAL_KEY = /TOKEN|SECRET|KEY|PASSWORD|PASS|CREDENTIAL|AUTH/i;

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

const isPublicKey = (key: string): boolean => key.toLowerCase().startsWith(PUBLIC_PREFIX);

/** NEXT_PUBLIC_* keys present in `env` (set or empty) that are not on the allowlist, sorted. Never their values. */
export function findDisallowedPublicKeys(
  env: Record<string, string | undefined>,
  allowlist: ReadonlySet<string> = PUBLIC_ENV_ALLOWLIST,
): string[] {
  return Object.keys(env)
    .filter((key) => isPublicKey(key) && !allowlist.has(key))
    .sort();
}

export function collectSecretValues(
  env: Record<string, string | undefined>,
  publicAllowlist: ReadonlySet<string> = PUBLIC_ENV_ALLOWLIST,
): string[] {
  const values = new Set<string>();
  for (const [key, value] of Object.entries(env)) {
    const lower = key.toLowerCase();
    if (value === undefined || value.length < MIN_SECRET_LENGTH) continue;
    // Only reviewed public variables are exempt; an unlisted NEXT_PUBLIC_* value is still searched for as a secret.
    if (isPublicKey(key) && publicAllowlist.has(key)) continue;
    if (NON_SECRET_KEYS.has(lower) && !CREDENTIAL_KEY.test(key)) continue;
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

export interface CheckOptions {
  /** Directory that contains `.next/` (the repo root). */
  cwd: string;
  env: Record<string, string | undefined>;
  log?: Pick<Console, "info" | "error">;
}

/** Exit codes: 0 clean, 1 leak or unlisted NEXT_PUBLIC_* variable (or no secrets to check for in CI), 2 nothing to scan. */
export async function runCheck({ cwd, env, log = console }: CheckOptions): Promise<number> {
  const disallowedPublic = findDisallowedPublicKeys(env);
  for (const key of disallowedPublic) {
    log.error(
      `PUBLIC ${key}: NEXT_PUBLIC_ variable is not on PUBLIC_ENV_ALLOWLIST in scripts/check-client-bundle.ts (Next inlines it into the browser bundle)`,
    );
  }
  const paths = await fg(".next/static/**/*", { cwd, dot: true, onlyFiles: true, unique: true });
  const scannable = paths.map(toPosix).filter((path) => !BINARY_EXTENSIONS.test(path));
  if (scannable.length === 0) {
    log.error("No files under .next/static to scan. Run `pnpm build` first.");
    return disallowedPublic.length > 0 ? 1 : 2;
  }
  const files = await Promise.all(
    // Paths come from the glob over .next/static, not from user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    scannable.map(async (path) => ({ path, content: await readFile(join(cwd, path), "utf8") })),
  );
  const secretValues = collectSecretValues(env);
  const leaks = findLeaks(files, secretValues);
  for (const leak of leaks) log.error(`LEAK ${leak.path}: ${leak.reason}`);
  if (leaks.length > 0 || disallowedPublic.length > 0) {
    log.error(
      `Client bundle check failed: ${String(leaks.length)} leak(s) in ${String(files.length)} files, ${String(disallowedPublic.length)} NEXT_PUBLIC_ variable(s) not allowlisted.`,
    );
    return 1;
  }
  // Count only the named server variables, not secretValues.length: pnpm/npm inject lifecycle variables into every
  // script run, so "zero collected values" is never true under `pnpm check:bundle`.
  // eslint-disable-next-line security/detect-object-injection -- name comes from the constant SECRET_NAMES tuple
  const namedValues = SECRET_NAMES.filter((name) => (env[name] ?? "").length >= MIN_SECRET_LENGTH);
  if (namedValues.length === 0) {
    log.error(
      `Warning: none of ${SECRET_NAMES.join(", ")} is set in the environment, so only variable names were checked. Export the .env.test values first.`,
    );
    const ci = env["CI"];
    if (ci !== undefined && ci !== "" && ci !== "false" && ci !== "0") return 1;
  }
  log.info(
    `Client bundle clean: ${String(files.length)} files scanned against ${String(secretValues.length)} secret values and ${String(SECRET_NAMES.length)} names.`,
  );
  return 0;
}
