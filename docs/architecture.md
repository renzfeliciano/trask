# Architecture

TRASK is one Next.js app (a modular monolith). Pages read data in React Server Components; every write
goes through a Server Action built with `createAction`. Business rules live in services, and only
repositories talk to the database. The database enforces tenant isolation on its own as well, so a
bug in one layer does not expose another workspace's data.

Decisions behind this page: [ADR index](decisions/).

## Request flow

```
Browser
  │
  ▼
src/proxy.ts            per-request CSP nonce, security headers, blocked paths (404),
  │                     default-deny redirect to /sign-in when no session cookie is present
  ▼
Page (RSC read) ─────┐
Client → Server Action ─┤
                     ▼
createAction (src/server/actions/create-action.ts)
  1. session          AuthPort.getSession() → AuthenticationError
  2. verified email   unverified sessions count as signed out
  3. input            Zod .strict() → ValidationError (unknown keys rejected)
  4. workspace role   findRole(ctx, workspaceId) from the database → NotFoundError for non-members
  5. permission       assertCan(ctx, permission) → AuthorizationError
  6. handler          service(ctx, input)
  7. errors           toSafeError → { code, message }; unexpected errors logged with allow-listed fields
                     ▼
repository (src/server/<module>/*repository.ts)
  withTenant(ctx)     each query runs in a transaction that first sets app.user_id
                     ▼
Postgres as trask_app  row-level security: rows of workspaces the user belongs to, nothing else
```

Phase 0 builds steps 1–7 with an `AuthPort` interface; the Better Auth adapter that implements it
arrives in Phase 1. The module exports `createActionFactory(deps)`, which returns `createAction`; Phase 1
binds the real session, role lookup and logger, and tests pass fakes. No feature actions exist yet.

## Layers and who may import whom

Enforced by `eslint-plugin-boundaries` in `eslint.config.mjs` and pinned by `tests/unit/lint-rules.test.ts`.

| Layer           | Folder                                            | May import                                       |
| --------------- | ------------------------------------------------- | ------------------------------------------------ |
| Routes          | `src/app`, `src/proxy.ts`                         | features, `components`, `lib`, `config`, server  |
| Feature UI      | `src/features/*/{components,hooks,schemas,types}` | `components`, `lib`, its own feature's actions   |
| Feature actions | `src/features/*/actions`                          | server, `lib`, `config`, its own schemas/types   |
| Server modules  | `src/server/*` (`server-only`)                    | other server modules, `lib`, `config`            |
| Repositories    | `src/server/**/*repository.ts`                    | `src/db`, generated Prisma client, errors, authz |
| Database client | `src/db` (`server-only`)                          | `config`, `lib`, generated Prisma client         |
| Design system   | `src/components`                                  | `lib`                                            |
| Pure helpers    | `src/lib`                                         | `lib`                                            |

Routes and actions cannot import repositories; services cannot import the database client. The bans on
`dangerouslySetInnerHTML`, `$queryRawUnsafe`/`$executeRawUnsafe`, `child_process` and `role ===`
comparisons apply to `src/**` only (see [ADR 0001](decisions/0001-modular-monolith-server-actions.md)).

## Tenant isolation, four layers

1. **Scoped repositories:** repository functions take a context (`{ userId }` today, `WorkspaceCtx` for
   workspace data) and run through `withTenant` (`src/db/tenant.ts`).
2. **Authorization:** `createAction` resolves the role from the database on every request and calls
   `assertCan`. Roles rank `VIEWER < MEMBER < ADMIN < OWNER` (`src/server/authz/`).
3. **Composite foreign keys:** a child row's `workspaceId` is part of its foreign key, so the database
   rejects a task that points at another workspace's column.
4. **Row-level security:** policies call `app.is_member(workspaceId)`; without `app.user_id` set, every
   policy hides every row.

Details and trade-offs: [ADR 0004](decisions/0004-tenant-isolation-composite-fk-and-rls.md).

## Configuration and secrets

`src/config/env.ts` validates `NODE_ENV`, `APP_URL`, `DATABASE_URL`, `LOG_LEVEL` and `ENCRYPTION_KEY`
with Zod (`getEnv()`, memoized). The server validates them once at start-up
(`src/instrumentation.ts`) and exits with code 1 if one is missing or malformed. The database client
(`getDb()`) and the logger (`getLogger()`) are created lazily: importing a module never requires
configuration, so unit tests and `next build` run without secrets. `MIGRATION_DATABASE_URL` is read only
by `prisma.config.ts`.

## Ports and adapters

| Port                          | Phase 0                                 | Later                         |
| ----------------------------- | --------------------------------------- | ----------------------------- |
| `Logger` (`server/ports`)     | pino with redaction (`server/adapters`) | any log sink                  |
| `AuthPort` (`server/ports`)   | interface only                          | Better Auth adapter (Phase 1) |
| Email, storage, rate limiting | not defined yet                         | the phases that need them     |

See [ADR 0006](decisions/0006-ports-and-adapters.md).

## Web hardening

`src/proxy.ts` composes rules from `src/server/http/`: a fresh nonce per request, a CSP with
`'strict-dynamic'` scripts and `frame-ancestors 'none'`, HSTS, `nosniff`, a referrer policy, a
permissions policy and COOP; no CORS headers. Dotfiles, source maps and archive/backup/dump/env files
answer 404 before anything else. `/dev/ui` answers 404 in production. Pages behind sign-in get
`Cache-Control: private, no-store`.

## Folder map

```
src/app/                routes: landing page, /api/health, /dev/ui, icons, manifest, error pages
src/proxy.ts            Next 16 proxy (formerly middleware)
src/instrumentation.ts  start-up hook: validates env, exits on failure (Node runtime only)
src/components/         design system (ui/), brand (logo, wordmark, mascot), theme provider
src/config/env.ts       environment schema
src/db/                 Prisma client (getDb) and withTenant
src/lib/                pure helpers: cn, rank keys, safe redirects, Result
src/server/             server-only code: actions, authz, crypto, errors, health, http, ports,
                        adapters, seed guard, workspaces (membership repository)
prisma/                 schema, migrations (incl. hand-written grants and RLS), seed
scripts/                client bundle scan, DB role verification
tests/                  unit/, integration/, e2e/, fixtures/, stubs/
```
