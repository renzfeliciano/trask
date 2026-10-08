import { ESLint } from "eslint";
import tseslint from "typescript-eslint";

// The snippets live at virtual src/... paths that are not on disk, so the type-aware project service cannot
// load them. Every rule asserted here is syntactic; type-aware rules are exercised by `pnpm lint` on real files.
const eslint = new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked });

async function ruleIds(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

describe("lint guardrails", () => {
  it("bans dangerouslySetInnerHTML", async () => {
    const messages = await ruleIds(
      "export const X = ({ x }: { x: string }) => <div dangerouslySetInnerHTML={{ __html: x }} />;\n",
      "src/components/ui/x.tsx",
    );
    expect(messages.map((m) => m.ruleId)).toContain("react/no-danger");
  });

  it("bans unsafe raw Prisma queries", async () => {
    const messages = await ruleIds(
      "export function run(db: { $queryRawUnsafe: (q: string) => unknown }, q: string) { return db.$queryRawUnsafe(q); }\n",
      "src/server/x/repository.ts",
    );
    expect(messages.map((m) => m.ruleId)).toContain("no-restricted-properties");
  });

  it("bans child_process imports", async () => {
    const messages = await ruleIds(
      'import { exec } from "node:child_process";\nexport const run = exec;\n',
      "src/server/x/service.ts",
    );
    expect(messages.map((m) => m.ruleId)).toContain("no-restricted-imports");
  });

  it("bans direct role comparisons and points to atLeast", async () => {
    const messages = await ruleIds(
      'export function check(member: { role: string }) { if (member.role === "ADMIN") { return true; } return false; }\n',
      "src/server/x/service.ts",
    );
    const hit = messages.find((m) => m.ruleId === "no-restricted-syntax");
    expect(hit?.message).toContain("atLeast");
  });

  it("blocks services from importing the db", async () => {
    const messages = await ruleIds(
      'import { db } from "@/db/client";\nexport const x = db;\n',
      "src/server/x/service.ts",
    );
    expect(messages.map((m) => m.ruleId)).toContain("boundaries/dependencies");
  });

  it("blocks client feature code from importing the db", async () => {
    const messages = await ruleIds(
      'import { db } from "@/db/client";\nexport const x = db;\n',
      "src/features/tasks/components/x.tsx",
    );
    expect(messages.map((m) => m.ruleId)).toContain("boundaries/dependencies");
  });

  it("lets repositories import the db", async () => {
    const messages = await ruleIds(
      'import { db } from "@/db/client";\nexport const x = db;\n',
      "src/server/x/repository.ts",
    );
    expect(messages.map((m) => m.ruleId)).not.toContain("boundaries/dependencies");
  });

  it("keeps a feature away from another feature's actions", async () => {
    const messages = await ruleIds(
      'import { act } from "@/features/other/actions/act";\nexport const x = act;\n',
      "src/features/tasks/components/x.tsx",
    );
    expect(messages.map((m) => m.ruleId)).toContain("boundaries/dependencies");
  });

  it("keeps the app and actions away from repositories", async () => {
    const code = 'import { repo } from "@/server/x/repository";\nexport const x = repo;\n';
    for (const filePath of [
      "src/app/page.tsx",
      "src/features/tasks/actions/x.ts",
      "src/proxy.ts",
    ]) {
      const messages = await ruleIds(code, filePath);
      expect(
        messages.map((m) => m.ruleId),
        filePath,
      ).toContain("boundaries/dependencies");
    }
  });

  it("keeps repositories off services and config", async () => {
    for (const source of ["@/server/y/service", "@/config/env"]) {
      const messages = await ruleIds(
        `import { y } from "${source}";\nexport const x = y;\n`,
        "src/server/x/repository.ts",
      );
      expect(
        messages.map((m) => m.ruleId),
        source,
      ).toContain("boundaries/dependencies");
    }
  });

  it("blocks the db from files outside any named layer", async () => {
    const code = 'import { db } from "@/db/client";\nexport const x = db;\n';
    for (const filePath of ["src/instrumentation.ts", "src/types/a.ts", "src/server/index.ts"]) {
      const messages = await ruleIds(code, filePath);
      expect(
        messages.map((m) => m.ruleId),
        filePath,
      ).toContain("boundaries/dependencies");
    }
  });

  it("keeps repositories off services in their own module, by alias and relative path", async () => {
    for (const source of ["@/server/x/service", "./service"]) {
      const messages = await ruleIds(
        `import { y } from "${source}";\nexport const x = y;\n`,
        "src/server/x/repository.ts",
      );
      expect(
        messages.map((m) => m.ruleId),
        source,
      ).toContain("boundaries/dependencies");
    }
  });

  it("lets services use the repository in their own module", async () => {
    const messages = await ruleIds(
      'import { repo } from "./repository";\nexport const x = repo;\n',
      "src/server/x/service.ts",
    );
    expect(messages.map((m) => m.ruleId)).not.toContain("boundaries/dependencies");
  });
});
