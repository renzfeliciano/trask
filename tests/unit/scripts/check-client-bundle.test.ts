import { describe, expect, it } from "vitest";
import { collectSecretValues, findLeaks } from "../../../scripts/check-client-bundle";

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
      npm_config_user_agent: "pnpm/12 npm/? node/v24 linux x64",
      REAL_SECRET: "keep-me-please",
    });
    expect(values).toEqual(["keep-me-please"]);
  });

  it("de-duplicates repeated values", () => {
    expect(collectSecretValues({ A_KEY: "same-value-1", B_KEY: "same-value-1" })).toEqual([
      "same-value-1",
    ]);
  });
});
