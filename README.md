# TRASK

TRASK (TRavis + tASKs) is a visual work-management app: Kanban boards for teams, built mobile first, with
workspaces that are isolated from each other in the server and in the database. It is also a portfolio
project for learning enterprise-grade full-stack engineering, so every phase ships with a written
explanation in `docs/learning/`.

**Status:** Phase 0 (foundation). There is no sign-in yet; the app serves the landing page, the health
check and a development-only component showcase at `/dev/ui`. Authentication arrives in Phase 1.

## Stack

| Area    | Choice (exact version)                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Runtime | Node.js 24 LTS (`.nvmrc`), pnpm 12.10.1 (`packageManager`)                                                |
| App     | Next.js 16.3.8 (App Router, Server Actions), React 19.3.0, TypeScript 6.0.3 (strict)                      |
| UI      | Tailwind CSS 4.3.3, Radix (`radix-ui` 1.6.7) via shadcn-style components, next-themes 0.4.6, Sonner 2.0.8 |
| Data    | PostgreSQL 18 (Neon in production), Prisma 7.10.0 with `@prisma/adapter-pg` 7.10.0 and `pg` 8.23.1        |
| Server  | Zod 4.6.5 (env and input validation), pino 10.4.0 (logging)                                               |
| Tests   | Vitest 5.0.3, Playwright 1.63.0, @axe-core/playwright 4.13.0                                              |
| Tooling | ESLint 10.12.0 + typescript-eslint 8.71.0, Prettier 3.9.9, knip 6.39.0, Husky 9.1.7, lint-staged 17.6.0   |
| CI      | GitHub Actions, gitleaks 8.30.1, Semgrep 1.179.0, `pnpm audit`, Renovate                                  |
| Later   | Better Auth (Phase 1), TanStack Query, dnd-kit and cmdk arrive with the phases that use them              |

Why these versions and how they move: [ADR 0007](docs/decisions/0007-version-and-upgrade-policy.md) and
[docs/upgrading.md](docs/upgrading.md).

## Prerequisites (Windows)

- **Node.js 24 LTS.** Check: `node -v` prints `v24.x`.
- **pnpm through Corepack.** In an administrator terminal: `corepack enable`, then
  `corepack prepare pnpm@12.10.1 --activate`. Check: `pnpm -v` prints `12.10.1`.
- **Docker Desktop**, running. It hosts the test database. Check: `docker version`.
- **Git for Windows.** The pre-commit hook runs in Git Bash, so `pnpm` must be on the PATH that Git sees.
  A GUI Git client that shows `pnpm: command not found` when you commit does not inherit your terminal's
  PATH. Fix it once by adding the folder that contains `pnpm.cmd` to the Windows user PATH and restarting
  the client, or by putting `export PATH="$PATH:/c/Program Files/nodejs"` (adjust to your install) in
  `~/.config/husky/init.sh`, which Husky runs before every hook.
- **Keep the repository outside folders protected by Controlled Folder Access** (Windows Security >
  Ransomware protection), such as `Documents`, `Desktop` or `Pictures`. Controlled Folder Access silently
  blocks writes from tools it does not know (node, pnpm, Prisma, Playwright), which shows up as random
  `EPERM` failures. `C:\Projects\trask` works.

## Set up from a fresh clone

```powershell
git clone https://github.com/renzfeliciano/trask.git C:\Projects\trask
cd C:\Projects\trask
copy .env.example .env      # then fill it in, see below
pnpm install                # also runs `prisma generate` and installs the Git hook
pnpm db:test:up             # test Postgres in Docker on 127.0.0.1:5433
pnpm db:deploy              # applies migrations as trask_migrator (Neon roles must exist first)
pnpm dev                    # http://localhost:3000
```

Fill in `.env` (never committed):

| Variable                 | Value                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `development`                                                                               |
| `APP_URL`                | `http://localhost:3000`                                                                     |
| `LOG_LEVEL`              | `info` (or `debug`, `warn`, `error`)                                                        |
| `DATABASE_URL`           | Neon `dev` branch, **pooled** endpoint, as `trask_app`                                      |
| `MIGRATION_DATABASE_URL` | Neon `dev` branch, **direct** endpoint, as `trask_migrator`                                 |
| `ENCRYPTION_KEY`         | 32 random bytes, base64: `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` |

No Neon account yet? Point both URLs at the Docker database instead, using the values from `.env.test`
(`localhost:5433/trask_test`). Note that `pnpm test:integration` empties that database on every run.

The server validates these variables with Zod (`src/config/env.ts`) when it starts
(`src/instrumentation.ts`). A missing or malformed variable stops it with exit code 1 and a message such
as `Invalid environment: DATABASE_URL (invalid_type)`: it names the variable and never prints the
value. `pnpm build` skips the check, so it needs no secrets.

## Scripts

| Script                  | What it does                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Next.js dev server on port 3000                                                               |
| `pnpm build`            | Production build                                                                              |
| `pnpm start`            | Serves the production build                                                                   |
| `pnpm lint`             | ESLint, including the architecture boundaries and security bans                               |
| `pnpm typecheck`        | `tsc --noEmit`                                                                                |
| `pnpm format`           | Prettier, writes changes                                                                      |
| `pnpm format:check`     | Prettier, checks only (CI)                                                                    |
| `pnpm test`             | Unit tests (Vitest project `unit`); needs no database or env                                  |
| `pnpm test:integration` | Integration tests against the Docker test database (Vitest project `integration`)             |
| `pnpm e2e`              | Playwright: builds, serves on port 3100, runs mobile Chrome, mobile Safari and desktop Chrome |
| `pnpm db:test:up`       | Starts the Docker test Postgres and waits until it accepts connections                        |
| `pnpm db:generate`      | Regenerates the Prisma client into `src/generated/prisma` (git-ignored)                       |
| `pnpm db:migrate`       | `prisma migrate dev`: creates a new migration (local Docker database only, see below)         |
| `pnpm db:deploy`        | `prisma migrate deploy`: applies pending migrations as `trask_migrator`                       |
| `pnpm db:seed`          | Seed script; refuses to run unless `NODE_ENV` is `development` or `test`                      |
| `pnpm knip`             | Finds unused files, exports and dependencies                                                  |
| `pnpm check:bundle`     | Scans `.next/static` for server secret values and names; run after `pnpm build`               |
| `postinstall`/`prepare` | Run by `pnpm install`: `prisma generate` and `husky` (installs the pre-commit hook)           |

The pre-commit hook runs lint-staged: ESLint `--fix` and Prettier on staged files.

## Database workflow

Two Postgres roles, never mixed:

- `trask_migrator` owns the schema and runs migrations (`MIGRATION_DATABASE_URL`).
- `trask_app` is what the app connects as (`DATABASE_URL`): data reads and writes only, not an owner,
  no `BYPASSRLS`, so row-level security always applies to it.

**Test database (Docker).** `pnpm db:test:up` starts `postgres:18-alpine` on `127.0.0.1:5433`.
`docker/postgres/init.sql` creates both roles (test-only passwords that match `.env.test`) and the
`trask_test` database. Storage is a tmpfs: after `docker compose down` the next `up` starts empty.
The integration suite applies migrations itself before it runs.

**Creating a migration.** Write migrations against the Docker database, never against Neon:
`prisma migrate dev` needs a shadow database, and only the local `trask_migrator` may create one.

```powershell
pnpm db:test:up
$env:NODE_ENV = "test"; pnpm db:migrate --create-only --name add_due_reminders; Remove-Item Env:NODE_ENV
```

With `NODE_ENV=test`, `prisma.config.ts` reads `.env.test` instead of `.env`. Review the generated SQL,
add anything Prisma does not manage (grants, RLS policies, the `app` schema functions), then run
`pnpm test:integration`. Neon only ever receives migrations through `pnpm db:deploy`.

Prisma commands that load the schema print a warning about `onDelete: SetNull` on a required field.
It is expected: see [ADR 0004](docs/decisions/0004-tenant-isolation-composite-fk-and-rls.md).

**Neon setup (once per project).** Postgres 18 is required: the migrations call `uuidv7()`.

1. Create the Neon project `trask` with Postgres 18 and a `main` branch.
2. As the project owner role (`neondb_owner`), in the SQL editor on `main`, create the two roles
   **before** the first `migrate deploy` (the migrations grant privileges to `trask_app` and fail if it
   does not exist). Use generated passwords, for example `openssl rand -hex 24`:

   ```sql
   CREATE ROLE trask_migrator LOGIN PASSWORD '<generated>' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
   CREATE ROLE trask_app LOGIN PASSWORD '<generated>' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
   -- The migrator creates the `app` schema (RLS helper functions) and the tables in `public`.
   -- Replace neondb with your database's name if Neon gave it another one.
   GRANT CREATE ON DATABASE neondb TO trask_migrator;
   GRANT CREATE ON SCHEMA public TO trask_migrator;
   ```

3. Create the `dev` branch from `main` (branches copy roles and data at creation time).
4. For each branch, run `pnpm db:deploy` with `MIGRATION_DATABASE_URL` set to that branch's **direct**
   endpoint as `trask_migrator`.
5. Prove the runtime role cannot escape row-level security, with the branch's `trask_app` URL:

   ```powershell
   $env:DATABASE_URL = "<Neon trask_app URL>"; pnpm tsx scripts/verify-db-roles.ts; Remove-Item Env:DATABASE_URL
   ```

   Expected output: `trask_app: rolbypassrls=false, owner=false` and exit code 0. Any line starting
   with `Row-level security does not apply` means the role is misconfigured.

## Testing

| Layer       | Command                 | Needs                                                                                |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------ |
| Unit        | `pnpm test`             | Nothing. `server-only` is stubbed (`tests/stubs/server-only.ts`).                    |
| Integration | `pnpm test:integration` | `pnpm db:test:up`. Loads `.env.test` itself; variables already set in the shell win. |
| E2E         | `pnpm e2e`              | Test database up **and migrated**, Playwright browsers installed (see below).        |

E2E, first time:

```powershell
pnpm exec playwright install chromium webkit
pnpm db:test:up
pnpm test:integration     # migrates trask_test (or: $env:NODE_ENV="test"; pnpm db:deploy)
pnpm e2e
```

`playwright.config.ts` parses `.env.test` and passes it to the server it starts, with `NODE_ENV`
forced to `production` so the tests see what ships (for example `/dev/ui` answers 404). The server
listens on port 3100 and is ready when `/api/health` answers, which also proves the database is
reachable. Set `E2E_SKIP_BUILD=1` to reuse an existing `.next` build.

Bundle secret scan, in Git Bash (the build and the check must see the same values):

```bash
set -a; . ./.env.test; set +a; unset NODE_ENV
pnpm build && pnpm check:bundle
```

## First push, CI and repository settings

1. Push the branch and open a pull request to `main`:
   `git push -u origin phase-0-foundation`. CI (`.github/workflows/ci.yml`) runs the jobs `checks`
   (lint, typecheck, unit, knip), `integration`, `build` (+ bundle scan), `e2e` (pull requests to
   `main` only) and `security` (gitleaks over the full history, `pnpm audit`, Semgrep). Confirm all green.
2. Install the free [Renovate GitHub app](https://github.com/apps/renovate) on the repository. Its first
   run opens a "Dependency Dashboard" issue. Configuration: `renovate.json`.
3. Settings > Branches > add a protection rule for `main`: require a pull request; require the status
   checks `checks`, `integration`, `build`, `e2e` and `security`; require branches to be up to date;
   block force pushes. In Settings > General, allow auto-merge (Renovate's dev-dependency auto-merge
   depends on it).
4. Settings > Code security: enable **private vulnerability reporting**, so the advisory link in
   `SECURITY.md` and `/.well-known/security.txt` works.
5. If the repository is not `renzfeliciano/trask`, update the links in `SECURITY.md` and
   `public/.well-known/security.txt`.

### Bumping gitleaks and Semgrep by hand

Renovate does not track these two; both live in the `security` job of `.github/workflows/ci.yml`.

- **gitleaks:** set `GITLEAKS_VERSION` to the new release, then set `GITLEAKS_SHA256` to the
  `gitleaks_<version>_linux_x64.tar.gz` line of that release's `gitleaks_<version>_checksums.txt` (on the
  GitHub release page). A wrong checksum fails the job on purpose.
- **Semgrep:** set `SEMGREP_VERSION`. Run the `pipx run semgrep==<version> scan ...` command from the
  same job locally once (Git Bash or WSL) before pushing; new releases add rules that can fail the job.
- Apply the same 3-day rule as for packages: take releases that are at least 3 days old.

## Deployment outline (Vercel + Neon)

1. Neon: the `main` branch is production; set it up as in "Neon setup" and run `pnpm db:deploy`
   against it from your machine before the first deploy and after every merged migration.
2. Vercel (Hobby): import the GitHub repository. In Project Settings set Node.js Version to 24.x. The
   build is `pnpm install` (which runs `prisma generate`) then `pnpm build`. If Vercel's pnpm does not
   match `packageManager` (12.10.1), add the environment variable `ENABLE_EXPERIMENTAL_COREPACK=1`. Not
   verified yet: no deployment has been made.
3. Vercel environment variables (Production): `APP_URL` (the production origin), `DATABASE_URL` (Neon
   `main`, pooled, `trask_app`), `ENCRYPTION_KEY` (a new key, not the development one), `LOG_LEVEL`.
   Do **not** give Vercel `MIGRATION_DATABASE_URL`: the running app never needs DDL rights.
4. Preview deployments, if enabled, point at the Neon `dev` branch, never at `main`.
5. Check after deploy: `GET /api/health` returns `{"status":"ok"}`; response headers include the CSP
   and HSTS. A wrong environment variable does not fail the build (it runs without secrets); it shows
   up as failing requests with `Invalid environment: <NAME>` in the runtime logs.

## More

- [Architecture](docs/architecture.md) and [decision records](docs/decisions/)
- Security: [threat model](docs/security/threat-model.md), [controls matrix](docs/security/controls.md),
  [secret rotation](docs/security/secret-rotation.md), [SECURITY.md](SECURITY.md)
- [Upgrading dependencies](docs/upgrading.md)
- [Content style](docs/content-style.md) (copy rules and the banned-phrase list)
- [Phase 0 learning notes](docs/learning/phase-0.md)
- [Foundation spec](docs/superpowers/specs/2026-10-08-trask-foundation-design.md) and
  [Phase 0 plan](docs/superpowers/plans/2026-10-08-trask-phase-0-foundation.md)
