# ADR 0002: Neon Postgres, node-postgres driver, two database roles

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

The app needs relational data with row-level security at zero cost. Production runs on Vercel; tests run
in Docker locally and in GitHub Actions. The spec first named Prisma's Neon adapter.

## Decision

- **PostgreSQL 18 on Neon** (free tier): branch `main` for production, `dev` for development. Tests and CI
  use `postgres:18-alpine` (same major). Postgres 18 is required: the migrations call `uuidv7()`.
- **`@prisma/adapter-pg` (node-postgres over TCP), not `@prisma/adapter-neon`.** One driver for Docker
  and Neon's pooled endpoint, so every test exercises the production driver. Server Actions run on
  Vercel's Node runtime, where TCP works. `@neondatabase/serverless` is not installed.
- **`pg` 8.23.1 is a direct, exact dependency** even though only the adapter imports it (hence
  `ignoreDependencies` in `knip.json`). The adapter asks for `^8.16.3`; the direct pin makes the driver
  version an explicit, reviewed change through Renovate instead of whatever a lockfile refresh resolves.
- **Two roles:** `trask_migrator` owns the schema and runs `prisma migrate deploy` over the direct
  endpoint (`MIGRATION_DATABASE_URL`, read only by `prisma.config.ts`); `trask_app` has DML grants only,
  is not an owner and has `NOBYPASSRLS` (`DATABASE_URL`, pooled endpoint).
- **The client is created lazily** (`getDb()` in `src/db/client.ts`), so importing a repository never
  requires a database URL (unit tests, `next build`).
- **Migrations are authored against the local Docker database.** `prisma migrate dev` needs a shadow
  database; only the local `trask_migrator` has `CREATEDB`. Neon receives migrations via `migrate deploy`.

## Rejected alternatives

- **Neon serverless driver (HTTP/WebSocket):** needed only for edge runtimes; it would make tests run a
  different driver from production.
- **One role for app and migrations:** an owner role is exempt from (non-forced) RLS and could change the
  schema at runtime.
- **`migrate dev` directly on the Neon `dev` branch:** would need `CREATEDB` on Neon for the shadow
  database, a privilege the migrator does not otherwise need.

## Consequences

- On Neon, `trask_app` and `trask_migrator` must be created by SQL **before** the first `migrate deploy`,
  and `trask_migrator` needs `CREATE` on the database (for `CREATE SCHEMA app`) and on schema `public`
  (README "Neon setup").
- `scripts/verify-db-roles.ts` checks a `DATABASE_URL` for superuser, `BYPASSRLS`, owner privileges
  (also inherited through role membership) and membership in `trask_migrator`. It has run against the
  local database; running it against each Neon branch is a manual step. Its ownership scan covers the
  `public` and `app` schemas only.
- Every module that needs data calls `getDb()` instead of importing a `db` constant.
