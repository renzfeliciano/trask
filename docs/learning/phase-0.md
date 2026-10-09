# Phase 0 learning notes: the foundation

Phase 0 has no features a user would notice. It builds the rails every later feature runs on, so that
the safe way to write code is also the easy way.

## What we built

| Piece                       | Where                                                              | One line                                                                      |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Env validation              | `src/config/env.ts`                                                | Zod checks every variable; errors name the variable, never the value.         |
| Error model                 | `src/server/errors/`                                               | `AppError` subclasses; `toSafeError` turns anything into `{ code, message }`. |
| Logger                      | `src/server/ports/logger.ts`, `src/server/adapters/pino-logger.ts` | pino behind a port, with redaction.                                           |
| Roles and permissions       | `src/server/authz/`                                                | Ranked roles, one permission table, `can` / `assertCan`.                      |
| Server Action wrapper       | `src/server/actions/create-action.ts`                              | Session, verified email, strict input, role, permission, safe errors.         |
| Schema and tenant integrity | `prisma/schema.prisma`, `prisma/migrations/`                       | Composite foreign keys, least-privilege grants, row-level security.           |
| Tenant-scoped client        | `src/db/tenant.ts`                                                 | `withTenant(ctx)` sets `app.user_id` inside each query's transaction.         |
| Web hardening               | `src/proxy.ts`, `src/server/http/`                                 | Nonce CSP, security headers, blocked paths, default-deny redirects.           |
| Design system               | `src/app/globals.css`, `src/components/`                           | Brand tokens (contrast-tested), primitives, logo, mascot states.              |
| Tests                       | `tests/unit`, `tests/integration`, `tests/e2e`                     | ~450 unit, RLS/FK integration against real Postgres, mobile-first E2E.        |
| CI and supply chain         | `.github/workflows/ci.yml`, `renovate.json`                        | Lint → tests → build + bundle scan → E2E, plus gitleaks, audit, Semgrep.      |

## Why this architecture

- **One app, one wrapper.** Every write is a Server Action made by `createAction`. One place to get the
  checks right instead of fifty ([ADR 0001](../decisions/0001-modular-monolith-server-actions.md)).
- **The database defends itself.** If a repository forgets a filter, row-level security still hides
  other workspaces; if code links a task to another workspace's column, the composite foreign key
  refuses it ([ADR 0004](../decisions/0004-tenant-isolation-composite-fk-and-rls.md)).
- **Lazy configuration.** `getEnv()`, `getDb()` and `getLogger()` run on first use, so tests and builds
  never need secrets.
- **Tooling enforces the rules.** Lint boundaries, the wrapped-action test, the banned-phrase test and
  the bundle scan turn conventions into failing checks.

## Important trade-offs

- **`ENABLE` not `FORCE` RLS:** `FORCE` would break the membership function; it is safe only because the
  app role is never the owner. `scripts/verify-db-roles.ts` checks exactly that.
- **One statement per transaction in `withTenant`:** simple and leak-proof; multi-statement transactions
  need a new helper first.
- **3-day release age:** protects against freshly hijacked packages; keeps TRASK a few days behind
  (Next 16.3.8 instead of 16.4.0).
- **`style-src 'unsafe-inline'`:** needed by Tailwind and Radix; style injection is far weaker than
  script injection.
- **Lazy modules, eager check:** `getEnv()`, `getDb()` and `getLogger()` run on first use so builds
  and tests need no secrets, and `src/instrumentation.ts` calls `getEnv()` once when the server starts
  so a broken deploy stops immediately instead of failing request by request.

## Security considerations

- RLS separates **workspaces**, not roles: a VIEWER's session could write at the database level.
  `assertCan` in `createAction` is the only role check, which is why "every action is wrapped" is a test.
- The proxy only checks that a session cookie **exists**. Real validation is server-side (Phase 1).
- Ids are always server-generated: unique constraints are checked before RLS, so a client-chosen id
  could reveal that another tenant's row exists.
- `AuditEvent` is insert-only but not tamper-evident; the `User` table has no RLS yet.
- Full list: [threat model](../security/threat-model.md) and [controls](../security/controls.md).

## What to learn

1. **Postgres RLS:** `CREATE POLICY`, `USING` vs `WITH CHECK`, `SECURITY DEFINER` + `search_path`. Read
   `prisma/migrations/20261008093000_rls/migration.sql` top to bottom.
2. **Transaction-local settings:** why `set_config(..., true)` is safe with connection pools and a
   session-level `SET` is not. `tests/integration/db/rls.test.ts` ("tenant context does not leak").
3. **CSP nonces:** how `'strict-dynamic'` lets Next's scripts run without `'unsafe-inline'` for scripts.
   `src/server/http/security-headers.ts`, `src/app/layout.tsx`.
4. **Discriminated unions in TypeScript:** `createAction`'s config uses `?: never` to make modes exclusive.
5. **Supply-chain basics:** exact pins, lockfiles, release-age gates, SHA-pinned Actions.

## What we can improve later

- Log the cause when the health ping fails (today the log line only says "health check failed").
- Widen the wrapped-action test to every `"use server"` file; keep `brandAction` private.
- Tenant-isolation registry: one isolation test per repository method (spec §7), once domain
  repositories exist.
- Deeper log redaction (`err.cause`, arrays) or a structured error serializer.
- Scan `.next/server` output in `check:bundle`; digest-pin the Postgres image.
- Key ids in encrypted payloads before storing any encrypted data.

## Check yourself

**1. A teammate adds a repository function and forgets `withTenant`, calling `getDb().board.findMany()`
directly. What happens?**
It returns an empty list, not an error and not every board. `app.user_id` is unset, so
`app.is_member()` is false and the policy hides all rows (fail closed). Lint allows the import because
repositories may use `src/db`; the integration test "no context returns no rows" pins the behavior.
The bug shows up as "my boards are missing", never as a data leak.

**2. A VIEWER calls a `task.create` action with a hand-crafted request. Which layer stops them?**
`createAction`: it loads the role from `WorkspaceMember` (never from input) and `assertCan` throws
`AuthorizationError` because `task.create` needs MEMBER. RLS would **not** stop it: the VIEWER is a
member of the workspace, and RLS only checks membership.

**3. A request sends `workspaceId` of a workspace the user is not in. What does the client see?**
`NOT_FOUND`, the same answer as for a workspace that does not exist, so ids cannot be probed. Even if
the action skipped that check, RLS would return no rows and reject writes.

**4. Someone sets a cookie named `better-auth.session_token` with a random value. Can they see private
pages?**
They pass the proxy, which only checks that the cookie exists. Every page and action that reads data
must call `requireAuth()` (Phase 1), which validates the session in the database. The proxy is a
convenience redirect, not the security boundary.

**5. `DATABASE_URL` is misspelled in the production environment. What happens, and why is the build still green?**
`next start` prints `Invalid environment: DATABASE_URL (invalid_type)` and exits with code 1
(`src/instrumentation.ts`), so a container never serves traffic with a broken config. The message
names the variable and never prints a value. `next build` skips the check because builds run without
secrets, so the build is green. On Vercel there is no long-running server: each cold start of the new
deployment fails with that message in the runtime logs. That is why the README's deploy checklist ends
with `GET /api/health`.
