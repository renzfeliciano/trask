/* eslint-disable security/detect-non-literal-fs-filename -- paths are temp dirs created by this test */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectSecretValues, findLeaks, runCheck } from "../../../scripts/check-client-bundle";

const secret = "s3cr3t-Value/with+chars=1234";
const clean = { path: ".next/static/chunks/app.js", content: 'console.log("hello", 42);' };

describe("findLeaks", () => {
  it("returns nothing for clean files", () => {
    expect(findLeaks([clean], [secret])).toEqual([]);
  });

  it("reports a file that contains a secret value", () => {
    const leaky = { path: ".next/static/chunks/leak.js", content: `const k="${secret}";` };
    const leaks = findLeaks([clean, leaky], [secret]);
    expect(leaks).toHaveLength(1);
    expect(leaks[0]?.path).toBe(".next/static/chunks/leak.js");
  });

  it("never puts the secret value in the reason", () => {
    const leaky = { path: "a.js", content: secret };
    const leaks = findLeaks([leaky], [secret]);
    expect(leaks).toHaveLength(1);
    for (const leak of leaks) {
      expect(leak.reason).not.toContain(secret);
      expect(JSON.stringify(leak)).not.toContain(secret);
    }
  });

  it.each(["DATABASE_URL", "MIGRATION_DATABASE_URL", "ENCRYPTION_KEY"])(
    "reports a file that references %s by name",
    (name) => {
      const leaks = findLeaks([{ path: "b.js", content: `process.env.${name}` }], []);
      expect(leaks).toHaveLength(1);
      expect(leaks[0]?.reason).toContain(name);
    },
  );

  it("does not report MIGRATION_DATABASE_URL as DATABASE_URL as well", () => {
    const leaks = findLeaks([{ path: "b.js", content: '"MIGRATION_DATABASE_URL"' }], []);
    expect(leaks.map((l) => l.reason).join("|")).not.toMatch(/(?<!MIGRATION_)DATABASE_URL/);
  });

  it("does not flag a name that is only part of a longer identifier", () => {
    expect(findLeaks([{ path: "c.js", content: "XDATABASE_URLS ENCRYPTION_KEY_ID" }], [])).toEqual(
      [],
    );
  });

  it("finds a secret that appears JSON-escaped", () => {
    const value = 'pa"ss\\word-12345';
    const content = JSON.stringify({ v: value });
    expect(findLeaks([{ path: "d.json", content }], [value])).toHaveLength(1);
  });

  it("finds a multi-line secret regardless of CRLF or LF", () => {
    const value = "-----BEGIN KEY-----\nabcdefghij\n-----END KEY-----";
    const content = value.replaceAll("\n", "\r\n");
    expect(findLeaks([{ path: "e.js", content }], [value])).toHaveLength(1);
    expect(
      findLeaks([{ path: "e.js", content: value }], [value.replaceAll("\n", "\r\n")]),
    ).toHaveLength(1);
  });

  it("reports posix paths even when given Windows separators", () => {
    const leaks = findLeaks([{ path: ".next\\static\\chunks\\w.js", content: secret }], [secret]);
    expect(leaks[0]?.path).toBe(".next/static/chunks/w.js");
  });

  it("ignores empty secret values instead of matching everything", () => {
    expect(findLeaks([clean], [""])).toEqual([]);
  });

  it("reports each leaking file once per reason", () => {
    const content = `${secret} ${secret} DATABASE_URL DATABASE_URL`;
    const leaks = findLeaks([{ path: "f.js", content }], [secret]);
    expect(leaks).toHaveLength(2);
  });
});

describe("collectSecretValues", () => {
  it("keeps server values of 8+ characters and drops NEXT_PUBLIC_*, short and empty values", () => {
    const values = collectSecretValues({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      ENCRYPTION_KEY: "abcdefgh",
      SHORT: "1234567",
      EMPTY: "",
      UNSET: undefined,
      NEXT_PUBLIC_SITE: "https://example.test/public",
    });
    expect(values.sort()).toEqual(["abcdefgh", "postgres://u:p@localhost:5432/db"]);
  });

  it("excludes well-known non-secret variables, case-insensitively", () => {
    const values = collectSecretValues({
      NODE_ENV: "production",
      LOG_LEVEL: "debug-verbose",
      APP_URL: "http://localhost:3000",
      Path: "/usr/local/bin:/usr/bin",
      GITHUB_SERVER_URL: "https://github.com",
      REAL_SECRET: "keep-me-please",
    });
    expect(values).toEqual(["keep-me-please"]);
  });

  it.each([
    "GITHUB_TOKEN",
    "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
    "NEXT_AUTH_SALT",
    "NPM_TOKEN",
    "npm_config__authtoken",
    "PNPM_HOME_PASSWORD",
    "GITHUB_SERVER_URL_SECRET",
    "DB_PASS",
    "AWS_CREDENTIALS_FILE",
  ])("always scans credential-looking key %s", (key) => {
    expect(collectSecretValues({ [key]: "ghp_abcdefgh12345678" })).toEqual([
      "ghp_abcdefgh12345678",
    ]);
  });

  it("does not exempt ambient tool prefixes any more", () => {
    expect(
      collectSecretValues({
        NEXT_RUNTIME_MODE: "nodejs-long",
        npm_lifecycle_event: "check-bundle",
      }),
    ).toHaveLength(2);
  });

  it("treats NEXT_PUBLIC_* as public even when the name looks like a credential", () => {
    expect(collectSecretValues({ NEXT_PUBLIC_MAPS_KEY: "pk_live_publishable" })).toEqual([]);
  });

  it("de-duplicates repeated values", () => {
    expect(collectSecretValues({ A_KEY: "same-value-1", B_KEY: "same-value-1" })).toEqual([
      "same-value-1",
    ]);
  });
});

describe("runCheck", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function project(files: Record<string, string>): Promise<string> {
    const cwd = await mkdtemp(join(tmpdir(), "bundle-scan-"));
    dirs.push(cwd);
    await mkdir(join(cwd, ".next", "static", "chunks"), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(cwd, ".next", "static", "chunks", name), content);
    }
    return cwd;
  }
  const capture = () => {
    const lines: string[] = [];
    const sink = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
    return { lines, log: { info: sink, error: sink } };
  };
  const env = {
    APP_DB_SECRET: "super-secret-value-123",
    ENCRYPTION_KEY: "base64-key-for-the-test-1234",
  };

  it("exits 0 on a clean bundle", async () => {
    const cwd = await project({ "ok.js": "console.log(1)" });
    const { lines, log } = capture();
    expect(await runCheck({ cwd, env, log })).toBe(0);
    expect(lines.join("\n")).toContain("Client bundle clean");
  });

  it("exits 1 and prints path and reason, never the secret, on a leak", async () => {
    const cwd = await project({ "ok.js": "1", "leak.js": `x="${env.APP_DB_SECRET}"` });
    const { lines, log } = capture();
    expect(await runCheck({ cwd, env, log })).toBe(1);
    const output = lines.join("\n");
    expect(output).toContain(
      "LEAK .next/static/chunks/leak.js: contains the value of a server-only environment variable",
    );
    expect(output).not.toContain(env.APP_DB_SECRET);
  });

  it("exits 2 when there is no build to scan", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bundle-scan-"));
    dirs.push(cwd);
    const { lines, log } = capture();
    expect(await runCheck({ cwd, env, log })).toBe(2);
    expect(lines.join("\n")).toContain("pnpm build");
  });

  it("warns without failing locally when no named server variable is set", async () => {
    const cwd = await project({ "ok.js": "1" });
    const { lines, log } = capture();
    expect(await runCheck({ cwd, env: {}, log })).toBe(0);
    expect(lines.join("\n")).toContain("Warning: none of DATABASE_URL");
  });

  it("fails in CI when none of the named server variables is set, even if other values exist", async () => {
    const cwd = await project({ "ok.js": "1" });
    const { log } = capture();
    expect(
      await runCheck({ cwd, env: { CI: "true", npm_config_user_agent: "pnpm/12 node/v24" }, log }),
    ).toBe(1);
  });

  it("fails in CI when no secret values were collected", async () => {
    const cwd = await project({ "ok.js": "1" });
    const { lines, log } = capture();
    expect(await runCheck({ cwd, env: { CI: "true" }, log })).toBe(1);
    expect(lines.join("\n")).toContain("Warning: none of DATABASE_URL");
  });
});
