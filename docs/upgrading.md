# Upgrading dependencies

Policy: [ADR 0007](decisions/0007-version-and-upgrade-policy.md). Renovate opens the PRs; this page is
for the ones a person has to drive.

## Routine (Renovate PR)

1. Read the PR's release notes. Anything about security, config or removed APIs?
2. Let CI run in full: lint, typecheck, unit, integration (RLS and grants), build + bundle scan, E2E on
   three browsers, security scans.
3. Dev-dependency patch/minor PRs merge themselves when green. Runtime minors: skim the diff of
   `pnpm-lock.yaml` for new transitive packages, then merge.

## Major upgrade

1. **Read** the changelog and migration guide end to end. Note breaking changes that touch TRASK.
2. **Branch** `chore/upgrade-<package>-<major>` and update the version (exact) in `package.json`.
3. **Run the codemod** if the project ships one (for example `pnpm dlx @next/codemod@<version> upgrade`),
   then read its diff; codemods miss cases.
4. **Grep for removed or renamed APIs** listed in the guide.
5. **Run everything locally:** `pnpm lint && pnpm typecheck && pnpm test`, `pnpm db:test:up && pnpm
test:integration`, `pnpm build`, `pnpm check:bundle` (README), `pnpm e2e`.
6. **Update the docs:** README stack table, the relevant ADR, and this watch list.
7. **One major per PR.** If two must move together (Next + eslint-config-next), Renovate already groups
   them.

Database-related upgrades (Prisma, `pg`, Postgres image) also need: `pnpm db:migrate --create-only`
against the Docker database to confirm no schema drift, and `scripts/verify-db-roles.ts` against Neon
`dev` after `pnpm db:deploy` there.

## Watch list

| Item                           | Waiting for                                          | Then                                                                                                               |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TypeScript 7.x                 | typescript-eslint support (it supports `<6.1` today) | Move from 6.0.3; check `tsc` flags and the ESLint type-aware rules.                                                |
| Prisma 8                       | A stable 8.x release that Better Auth supports       | Follow the Prisma upgrade guide; re-check `@prisma/adapter-pg`, the hand-edited FK SQL and `withTenant`.           |
| `@dnd-kit/react` 1.0           | A 1.0 release                                        | Phase 6 decides between it and `@dnd-kit/core` + `@dnd-kit/sortable`.                                              |
| Node 26                        | Node 26 entering LTS                                 | Update `.nvmrc`, `engines`, `@types/node` (Renovate asks for dashboard approval first).                            |
| Next 16.4 + eslint-config-next | Both older than 3 days (Renovate "next" group)       | Remove the `@eslint/compat` `fixupConfigRules` wrapper in `eslint.config.mjs` and the `@eslint/compat` dependency. |
| `security.txt` expiry          | 2027-10-08 (`public/.well-known/security.txt`)       | Set `Expires` a year ahead; an expired file is ignored by scanners.                                                |
| gitleaks, Semgrep              | New releases (not tracked by Renovate)               | Bump `GITLEAKS_VERSION` + `GITLEAKS_SHA256` and `SEMGREP_VERSION` in `.github/workflows/ci.yml`.                   |

## shadcn components

`components.json` points `utils` at `@/lib/cn`. shadcn 4.21.x rewrites that into a bare
`import { cn } from "cn"` and adds the unrelated npm package `cn`. After every
`pnpm dlx shadcn@<version> add <component>`:

1. `git diff package.json`: remove `cn` if it was added (`pnpm remove cn`).
2. Change `from "cn"` to `from "@/lib/cn"` in the new files.
3. Replace `class-variance-authority` usage with a typed class map (see `src/components/ui/button.tsx`)
   and do not install it.
4. Swap shadcn's default colors for TRASK tokens and run `pnpm test` (contrast and banned-phrase tests).
