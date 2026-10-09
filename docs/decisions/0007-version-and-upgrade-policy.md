# ADR 0007: Version and upgrade policy

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

The project should run on current stable releases, yet a freshly published release is the main window
for a hijacked package. Upgrades must be routine, small and covered by tests.

## Decision

- **Latest stable that has aged at least 3 days.** `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320`
  (minutes) and `saveExact: true`; Renovate uses the same `3 days`. No RC, beta, canary or pre-1.0
  packages unless recorded here. Example: Next.js 16.4.0 was 2 days old at scaffold time, so TRASK pins
  16.3.8 (and eslint-config-next 16.3.8); Renovate moves both once the window passes.
- **Exact pins, committed lockfile, `pnpm install --frozen-lockfile` in CI.** Node 24 in `.nvmrc` and
  `engines`; pnpm in `packageManager`.
- **Renovate** (`renovate.json`): weekly, grouped (next, prisma, react, eslint, dnd-kit, Playwright +
  Postgres image), dev-dependency patch/minor auto-merge only when CI is green, majors always manual,
  Node and `@types/node` majors only after a dashboard approval. Security PRs any time.
- **GitHub Actions pinned by commit SHA.** gitleaks (release binary + committed SHA-256) and Semgrep
  (`pipx run semgrep==…`) are pinned in `ci.yml` and bumped by hand; Renovate does not track them.
- **Recorded exceptions:**
  - `@types/node` stays on 24.x to match the runtime (npm `latest` is 26.x).
  - `@eslint/compat` wraps eslint-config-next 16.3.8, which predates ESLint 10. Remove it when
    eslint-config-next 16.4+ lands.
  - Pre-1.0 packages: `next-themes` 0.4.6 (the de facto theme switcher for the App Router, small and
    replaceable) and `colorjs.io` 0.7.1 (dev only, the contrast test).
  - Not installed because pre-1.0: `class-variance-authority` (components use typed class maps) and the
    `server-only` npm package (Next resolves it internally; Vitest and `tsx` map it to
    `tests/stubs/server-only.ts`).
  - `allowBuilds` in `pnpm-workspace.yaml` runs install scripts only for Prisma. `sharp` and
    `unrs-resolver` are set to `false`; revisit if `next/image` optimization or CI needs `sharp`.

## Rejected alternatives

- **Semgrep's recommended 7-day release age:** the two registry rules that demand it are excluded in
  `ci.yml`. Most hijacked releases are pulled within hours, and 7 days keeps TRASK further behind than the
  user asked for. Revisit if a compromised release ever slips through.
- **Dependabot:** Renovate's grouping, dependency dashboard and auto-merge-when-green rules cover this
  setup in one config file, without an extra auto-merge workflow.
- **Caret ranges:** reproducibility depends on the lockfile alone, and upgrades become invisible.

## Consequences

- TRASK runs up to a few days behind the newest release.
- A fresh security fix is also held by pnpm's age gate locally; add that package to
  `minimumReleaseAgeExclude` for the one install if needed.
- `shadcn add` (4.21.x) rewrites the `@/lib/cn` alias from `components.json` into a bare
  `import { cn } from "cn"` and installs an unrelated `cn` package. Check every added component
  (`docs/upgrading.md`).
- Upgrade steps and the watch list live in `docs/upgrading.md`.
