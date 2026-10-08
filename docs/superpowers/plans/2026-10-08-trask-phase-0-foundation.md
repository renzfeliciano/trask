# TRASK Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A secure, tested, deployable empty shell of TRASK: tooling, guardrails, server core, database with RLS, design-system foundation, CI and docs. No product features yet.

**Architecture:** Modular monolith in Next.js. Server Actions go through `createAction` → services → scoped repositories → Prisma → Postgres with Row-Level Security. Security controls, tests and lint rules land before any feature code, so every later phase inherits them.

**Tech Stack:** Node 24 LTS · pnpm 12.10 · Next.js 16.4 · React 19.3 · TypeScript 6.0.3 · Tailwind 4.3 · Prisma 7.10 (`@prisma/adapter-pg`) · PostgreSQL 18 · Zod 4.6 · pino 10.4 · Vitest 5.0 · Playwright 1.63 · ESLint 10.12 · shadcn CLI 4.21.

**Spec:** `docs/superpowers/specs/2026-10-08-trask-foundation-design.md`

## Global Constraints

- Latest **stable** versions only; exact versions per spec §8. No RC/beta/canary/pre-1.0 unless an ADR records why. Every dependency is added with an exact version.
- pnpm settings live in `pnpm-workspace.yaml` (pnpm 12 reads only auth/registry from `.npmrc`): `saveExact: true`, `minimumReleaseAge: 4320` (minutes = 3 days).
- Node `24` in `.nvmrc`; `"engines": { "node": ">=24 <25" }`; `"packageManager": "pnpm@12.10.1"`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`.
- Everything under `src/server/**` and `src/db/**` imports `server-only`.
- Only `src/server/*/repository.ts` (and test helpers) may import `src/db`.
- UUIDv7 primary keys (`@default(uuid(7)) @db.Uuid`), `createdAt`/`updatedAt` on every model.
- Roles: `OWNER | ADMIN | MEMBER | VIEWER`; ranks `VIEWER 1, MEMBER 2, ADMIN 3, OWNER 4`.
- DB roles: `trask_migrator` (owns schema, runs migrations), `trask_app` (DML only, `NOBYPASSRLS`, not owner).
- Headers: HSTS `max-age=63072000; includeSubDomains` (no preload); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; CSP with per-request nonce and `frame-ancestors 'none'`; no `X-Powered-By`; no CORS headers.
- Authenticated responses: `Cache-Control: private, no-store`.
- Copy rules: spec §5 "Quality bar" — no banned phrases, buttons name the action, no lorem/placeholder data, no emoji in UI.
- Mobile-first: base styles target phones; `md`/`lg` enhance.
- Git commands run from the repo root; commit messages use Conventional Commits.

## Spec amendments decided while planning

These refine the spec; Task 16 writes them into the spec and ADRs.

1. **`@prisma/adapter-pg` instead of `@prisma/adapter-neon`.** One driver (node-postgres over TCP) for Docker tests and Neon (pooled endpoint), so tests exercise the production driver. Vercel runs Server Actions on the Node runtime, where TCP is fine.
2. **RLS is `ENABLE`d, not `FORCE`d.** `trask_app` is not the table owner, so RLS always applies to it. `FORCE` would also apply RLS to the owner and break the `SECURITY DEFINER` membership function (infinite policy recursion).
3. **Better Auth `Session`/`Account`/`Verification` tables arrive in Phase 1** via the Better Auth CLI as an additive migration. Phase 0 creates only `User` with Better Auth's core user fields.
4. **`src/proxy.ts`**, Next.js 16's replacement for `middleware.ts`.
5. **`Activity` and `AuditEvent` are append-only by grants** (`trask_app` gets `SELECT, INSERT` on Activity and `INSERT` only on AuditEvent).
6. **Idempotency lives on the entity, not in `createAction`.** Each create action that needs it adds a nullable `idempotencyKey` with `@@unique([workspaceId, idempotencyKey])` (first use: Task creation in Phase 5). The service returns the existing record on that unique violation, so Phase 0 needs no generic idempotency store.

## Review Focus

1. **A repository that forgets `withTenant`** and queries with the bare app client must get **zero rows**, not an error and not all rows. Pinned in Task 9 (`no context returns no rows`).
2. **Pooled-connection leakage:** a tenant setting from request A must not survive into the next query on the same pooled connection. Pinned in Task 9 (`tenant context does not leak across queries`).
3. **CSP nonce vs. hydration and the theme script:** a strict CSP can silently block Next's runtime or next-themes' inline script, giving a blank or unstyled page. Pinned in Task 13 (no CSP console violations; theme toggle works).
4. **Windows dev machine vs. Linux CI:** CRLF line endings and `\` paths break the content/bundle scanners and Prettier checks. Mitigated in Task 1 (`.gitattributes` eol=lf; scanners use `fast-glob` with posix paths). Pinned by the scanner tests using posix-normalized paths.
5. **Secrets in boot failures:** an invalid env must name the bad key without printing its value (logs get copied around). Pinned in Task 3.

---

## File structure (Phase 0)

```
trask/
├── .github/workflows/ci.yml
├── .gitattributes  .gitignore  .nvmrc  .prettierrc.json  .env.example  .env.test
├── docker-compose.yml
├── docker/postgres/init.sql                # roles + test DB
├── eslint.config.mjs  knip.json  renovate.json  .gitleaks.toml
├── next.config.ts  playwright.config.ts  vitest.config.ts  prisma.config.ts
├── package.json  pnpm-workspace.yaml  tsconfig.json  components.json
├── prisma/schema.prisma  prisma/migrations/…  prisma/seed.ts
├── public/.well-known/security.txt
├── scripts/check-client-bundle.ts
├── SECURITY.md  README.md
├── docs/{architecture.md, content-style.md, upgrading.md, decisions/, security/, learning/, superpowers/}
├── src/
│   ├── proxy.ts
│   ├── app/{layout.tsx, globals.css, (marketing)/page.tsx, api/health/route.ts, dev/ui/page.tsx, not-found.tsx, error.tsx}
│   ├── components/ui/{button,input,dialog,sheet,sonner,skeleton,empty-state,error-state,theme-toggle}.tsx
│   ├── components/providers/theme-provider.tsx
│   ├── config/env.ts
│   ├── db/{client.ts, tenant.ts}
│   ├── lib/{result.ts, rank.ts, safe-redirect.ts, cn.ts}
│   └── server/
│       ├── actions/{create-action.ts, action-brand.ts}
│       ├── authz/{roles.ts, permissions.ts}
│       ├── crypto/{encryption.ts, compare.ts}
│       ├── errors/{app-error.ts, to-safe-error.ts}
│       ├── http/{security-headers.ts, public-paths.ts}
│       ├── ports/{logger.ts, auth.ts}
│       ├── adapters/pino-logger.ts
│       ├── workspaces/membership-repository.ts
│       └── seed/guard.ts
└── tests/{unit/, integration/, e2e/, fixtures/}
```

---

### Task 0: Prerequisites (manual, with the user)

No code. Each item has a check.

- [ ] **Windows Ransomware protection** allows the Claude desktop app (or is off for the trask folder). Check: Claude can create `docs/` in the trask folder.
- [ ] **Toolchain on Windows:** Node 24 LTS (`node -v` → `v24.x`), pnpm (`corepack enable && corepack prepare pnpm@12.10.1 --activate`, then `pnpm -v` → `12.10.1`), Docker Desktop running (`docker version`), Git.
- [ ] **Git:** in the trask folder, `git init -b main` and `git remote add origin https://github.com/renzfeliciano/trask.git`. Check: `git remote -v` shows origin.
- [ ] **Neon** (Neon connector or console): project `trask`, Postgres 18, region `aws-ap-southeast-1` (Singapore). Branches: `main` (production) and `dev`. As the project owner role, run the role SQL from Task 8's `docker/postgres/init.sql` (role part only) on each branch, with strong generated passwords. Check: `SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname LIKE 'trask_%'` → both roles, `rolbypassrls = false`.
- [ ] **Local `.env`** (git-ignored) from `.env.example`: `DATABASE_URL` = `dev` branch **pooled** endpoint as `trask_app`; `MIGRATION_DATABASE_URL` = `dev` branch **direct** endpoint as `trask_migrator`; `ENCRYPTION_KEY` = `openssl rand -base64 32`.

---

### Task 1: Scaffold, toolchain, unit-test harness

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitattributes`, `.gitignore`, `.prettierrc.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/(marketing)/page.tsx`, `src/lib/cn.ts`
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `format`, `test` (`vitest run --project unit`), `test:integration` (`vitest run --project integration`), `e2e` (`playwright test`), `db:test:up` (`docker compose up -d --wait`), `db:migrate`, `db:deploy`, `db:seed`, `knip`, `check:bundle`. Vitest projects `unit` (`tests/unit/**/*.test.{ts,tsx}`, node env) and `integration` (`tests/integration/**/*.test.ts`, `fileParallelism: false`). Path alias `@/*` → `src/*`. `cn(...classes)` (clsx + tailwind-merge).

- [ ] **Step 1:** Scaffold with `pnpm create next-app@16.4.0` (TypeScript, App Router, `src/` dir, Tailwind, ESLint, no Turbopack flags beyond defaults), then pin every dependency to the exact versions in spec §8. Apply the Global Constraints to `package.json`, `pnpm-workspace.yaml`, `.nvmrc` and `tsconfig.json`.
- [ ] **Step 2:** `.gitattributes`: `* text=auto eol=lf`. `.gitignore` adds `.env`, `.env.local`, `.env.*.local`, `/src/generated`, `/playwright-report`, `/test-results`, `/coverage`.
- [ ] **Step 3:** `next.config.ts`: `poweredByHeader: false`, `productionBrowserSourceMaps: false`, Server Actions body size limit `"1mb"` (key per Next 16 docs), `reactStrictMode: true`.
- [ ] **Step 4:** Home page (`(marketing)/page.tsx`): the `TRASK` wordmark as `<h1>`, and one line: "Work should move, not become clutter." Nothing else.
- [ ] **Step 5: Write the failing test** `tests/unit/smoke.test.ts`:
```ts
import { cn } from "@/lib/cn";
test("cn merges conflicting tailwind classes", () => {
  expect(cn("p-2", "p-4")).toBe("p-4");
});
```
- [ ] **Step 6:** Run `pnpm test` → FAIL (`cn` missing). Implement `src/lib/cn.ts`. Run `pnpm test` → PASS.
- [ ] **Step 7:** Run `pnpm typecheck && pnpm build` → both succeed.
- [ ] **Step 8: Commit** — `chore: scaffold Next.js 16 app with pinned toolchain`

---

### Task 2: Lint guardrails

**Files:**
- Create/replace: `eslint.config.mjs`, `knip.json`
- Test: `tests/unit/lint-rules.test.ts`

**Interfaces:**
- Produces: lint rules every later task must pass.

Rule matrix (eslint-plugin-boundaries elements → may import):

| Element (pattern) | May import |
|---|---|
| `components-ui` (`src/components/**`) | `lib` |
| `lib` (`src/lib/**`) | `lib` |
| `config` (`src/config/**`) | `lib` |
| `feature-client` (`src/features/*/{components,hooks,schemas,types}/**`) | `components-ui`, `lib`, same-feature `schemas`/`types`/`actions` |
| `feature-actions` (`src/features/*/actions/**`) | `server`, `lib`, `config`, same-feature `schemas`/`types` |
| `app` (`src/app/**`, `src/proxy.ts`) | `feature-*`, `components-ui`, `lib`, `config`, `server` |
| `server` (`src/server/**` except repositories) | `server`, `lib`, `config` |
| `repository` (`src/server/**/*repository.ts`) | `db`, `server/errors`, `server/authz`, `lib` |
| `db` (`src/db/**`) | `config`, `lib`, generated Prisma client |

- [ ] **Step 1: Write the failing test** `tests/unit/lint-rules.test.ts` using `new ESLint()` and `lintText(code, { filePath })`. One `it` per row, asserting the listed `ruleId` appears:
  - `<div dangerouslySetInnerHTML={{__html: x}} />` in `src/components/ui/x.tsx` → `react/no-danger`
  - `db.$queryRawUnsafe(q)` in `src/server/x/repository.ts` → `no-restricted-properties`
  - `import { exec } from "node:child_process"` in `src/server/x/service.ts` → `no-restricted-imports`
  - `if (member.role === "ADMIN") {}` in `src/server/x/service.ts` → `no-restricted-syntax` (message mentions `atLeast`)
  - `import { db } from "@/db/client"` in `src/server/x/service.ts` → `boundaries/element-types`
  - `import { db } from "@/db/client"` in `src/features/tasks/components/x.tsx` → `boundaries/element-types`
  - `import { db } from "@/db/client"` in `src/server/x/repository.ts` → **no** boundaries error
- [ ] **Step 2:** Run `pnpm test tests/unit/lint-rules.test.ts` → FAIL.
- [ ] **Step 3:** Write `eslint.config.mjs`: `eslint-config-next` (core-web-vitals + typescript), `typescript-eslint` `strictTypeChecked`, `eslint-plugin-security` recommended, `eslint-plugin-boundaries` with the matrix above (default `disallow`), `react/no-danger: error`, `no-restricted-properties` for `$queryRawUnsafe`/`$executeRawUnsafe`, `no-restricted-imports` for `child_process`/`node:child_process`, `no-restricted-syntax` selector `BinaryExpression[operator=/^[!=]==?$/] > MemberExpression[property.name='role']` with message "Compare roles with atLeast() from @/server/authz/roles.", `eslint-config-prettier` last. `knip.json` with Next.js plugin defaults.
- [ ] **Step 4:** Run the test → PASS. Run `pnpm lint && pnpm knip` → clean.
- [ ] **Step 5: Commit** — `chore: add security and architecture lint guardrails`

---

### Task 3: Validated environment config

**Files:**
- Create: `src/config/env.ts`, `.env.example`, `.env.test`
- Test: `tests/unit/config/env.test.ts`

**Interfaces:**
- Produces: `type Env = { NODE_ENV: "development" | "test" | "production"; APP_URL: string; DATABASE_URL: string; LOG_LEVEL: "debug" | "info" | "warn" | "error"; ENCRYPTION_KEY: Buffer }`; `parseEnv(source: Record<string, string | undefined>): Env` (throws `Error`); `getEnv(): Env` (memoized `parseEnv(process.env)`). `MIGRATION_DATABASE_URL` is read only by `prisma.config.ts`, not by the app.

- [ ] **Step 1: Write the failing tests:**
  - `accepts a complete valid environment` → returns `ENCRYPTION_KEY` as a 32-byte `Buffer`, `LOG_LEVEL` defaults to `"info"`.
  - `rejects a missing DATABASE_URL` → throws, message contains `DATABASE_URL`.
  - `rejects a non-postgres DATABASE_URL` (`mysql://…`) → throws.
  - `rejects an ENCRYPTION_KEY that is not 32 bytes` → throws, message contains `ENCRYPTION_KEY`.
  - `never includes secret values in the error` → with `DATABASE_URL="postgres://u:SuperSecret123@h/db"` and a bad `APP_URL`, the message does not contain `SuperSecret123`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with a Zod 4 schema; the error lists only issue paths and Zod's issue codes. File starts with `import "server-only"`. `.env.example` documents every variable with a one-line comment. `.env.test` holds Docker-only values (`postgres://trask_app:trask_app_test@localhost:5433/trask_test`, a fixed test `ENCRYPTION_KEY`) and is committed (gitleaks allowlist in Task 15).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(config): validate environment at boot without leaking values`

---

### Task 4: Error model and Result type

**Files:**
- Create: `src/lib/result.ts`, `src/server/errors/app-error.ts`, `src/server/errors/to-safe-error.ts`
- Test: `tests/unit/server/errors.test.ts`

**Interfaces:**
- Produces (`src/lib/result.ts`, client-safe): `type ErrorCode = "VALIDATION" | "AUTHENTICATION" | "AUTHORIZATION" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT" | "INTERNAL"`; `type SafeError = { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> }`; `type Result<T> = { ok: true; data: T } | { ok: false; error: SafeError }`.
- Produces (`app-error.ts`): `abstract class AppError extends Error { abstract readonly code: ErrorCode }` and subclasses `ValidationError(fieldErrors?: Record<string, string[]>)`, `AuthenticationError(message?)`, `AuthorizationError()`, `NotFoundError()`, `ConflictError()`, `RateLimitError(retryAfterSeconds?: number)`, `InternalError(cause?: unknown)`.
- Produces: `toSafeError(err: unknown): SafeError`.

Default user-facing messages (exact copy):

| Code | Message |
|---|---|
| VALIDATION | Some fields need attention. |
| AUTHENTICATION | Sign in to continue. |
| AUTHORIZATION | You don't have access to do that. |
| NOT_FOUND | We couldn't find that. |
| CONFLICT | This changed while you were editing. Refresh and try again. |
| RATE_LIMIT | Too many attempts. Wait a moment and try again. |
| INTERNAL | Something went wrong on our side. Try again. |

- [ ] **Step 1: Write the failing tests:** each `AppError` subclass maps to its code and default message; `ValidationError` keeps `fieldErrors`; `AuthenticationError("Verify your email to continue.")` keeps its custom message; a plain `Error("relation \"Task\" does not exist")` → `INTERNAL` and the message does **not** contain `relation`; a Prisma known-request error `P2002` → `CONFLICT`, `P2025` → `NOT_FOUND`, any other Prisma code → `INTERNAL`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (detect Prisma errors by `code` property shape so `src/server/errors` doesn't import the client). **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(errors): add AppError hierarchy and safe error mapping`

---

### Task 5: Logger port with redaction

**Files:**
- Create: `src/server/ports/logger.ts`, `src/server/adapters/pino-logger.ts`
- Test: `tests/unit/server/pino-logger.test.ts`

**Interfaces:**
- Produces: `interface Logger { debug(obj: object, msg: string): void; info(…); warn(…); error(…); child(bindings: object): Logger }`; `createLogger(options: { level: Env["LOG_LEVEL"]; destination?: pino.DestinationStream }): Logger`; `logger` (default instance from `getEnv()`).

- [ ] **Step 1: Write the failing test:** log `{ password: "p", token: "t", user: { email: "a@b.c", accessToken: "x" }, headers: { cookie: "c", authorization: "Bearer y" }, userId: "u1" }` into an in-memory stream; parsed JSON has `"[REDACTED]"` for password, token, user.email, user.accessToken, headers.cookie, headers.authorization, and keeps `userId: "u1"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with pino `redact: { paths: [...], censor: "[REDACTED]" }` covering top-level and one-level-nested `password`, `token`, `accessToken`, `refreshToken`, `secret`, `email`, `cookie`, `authorization`, plus `headers.*` equivalents. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(observability): add redacting pino logger behind Logger port`

---

### Task 6: Roles and permissions

**Files:**
- Create: `src/server/authz/roles.ts`, `src/server/authz/permissions.ts`
- Test: `tests/unit/server/authz.test.ts`

**Interfaces:**
- Produces (`roles.ts`): `ROLES = ["VIEWER", "MEMBER", "ADMIN", "OWNER"] as const`; `type Role`; `ROLE_RANK: Record<Role, number>`; `atLeast(role: Role, min: Role): boolean`; `canAssignRole(actor: Role, target: Role): boolean`.
- Produces (`permissions.ts`): `type Permission`; `PERMISSION_MIN_ROLE: Record<Permission, Role>`; `can(role: Role, permission: Permission): boolean`; `assertCan(ctx: { role: Role }, permission: Permission): void` (throws `AuthorizationError`).

Permission → minimum role:

| VIEWER | MEMBER | ADMIN | OWNER |
|---|---|---|---|
| `workspace.read`, `board.read`, `task.read`, `member.read` | `board.create`, `board.update`, `task.create`, `task.update`, `task.delete` | `workspace.update`, `board.delete`, `member.invite`, `member.remove`, `member.updateRole` | `workspace.delete` |

- [ ] **Step 1: Write the failing tests:** a `test.each` over **every role × every permission** asserting `can()` equals `ROLE_RANK[role] >= ROLE_RANK[PERMISSION_MIN_ROLE[p]]` against the table above (written out literally in the test, not derived from the implementation). `assertCan({ role: "VIEWER" }, "task.create")` throws `AuthorizationError`. `canAssignRole`: ADMIN→MEMBER true, ADMIN→ADMIN true, ADMIN→OWNER false, MEMBER→VIEWER false, OWNER→OWNER true.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(authz): add ranked roles and centralized permission checks`

---

### Task 7: Pure helpers — rank, safe redirect, crypto

**Files:**
- Create: `src/lib/rank.ts`, `src/lib/safe-redirect.ts`, `src/server/crypto/encryption.ts`, `src/server/crypto/compare.ts`
- Test: `tests/unit/lib/rank.test.ts`, `tests/unit/lib/safe-redirect.test.ts`, `tests/unit/server/crypto.test.ts`

**Interfaces:**
- Produces: `rankBetween(before: string | null, after: string | null): string` and `ranksBetween(count: number, before: string | null, after: string | null): string[]` (wrap `fractional-indexing` 4.x, throw `RangeError` when `before >= after`); `safeRedirectPath(input: string | null | undefined, fallback?: string): string` (default fallback `"/"`); `encrypt(plaintext: string, key: Buffer): string` → `"v1.<iv>.<tag>.<ciphertext>"` (base64url, AES-256-GCM, 12-byte random IV); `decrypt(payload: string, key: Buffer): string`; `safeEqual(a: string, b: string): boolean` (`crypto.timingSafeEqual` over SHA-256 digests so lengths never leak).

- [ ] **Step 1: Write the failing tests:**
  - rank: `rankBetween(null, null)` is non-empty; `a < rankBetween(a, b) < b`; inserting 500 times at the front keeps strict order; `rankBetween("b", "a")` throws `RangeError`; `ranksBetween(5, null, null)` is strictly increasing.
  - safe redirect: `"/w/acme/b/1?task=TRK-42"` kept; fallback for `"//evil.com"`, `"https://evil.com"`, `"/\\evil.com"`, `"javascript:alert(1)"`, `"/%0d%0aSet-Cookie:x"`, `""`, `null`.
  - crypto: round-trip; two encryptions of the same text differ; flipping one ciphertext char → `decrypt` throws; wrong key throws; `safeEqual("abc", "abc")` true, `safeEqual("abc", "abd")` false, `safeEqual("a", "abc")` false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(lib): add rank keys, safe redirects, and AES-GCM helpers`

---

### Task 8: Database schema, roles, composite foreign keys

**Files:**
- Create: `docker-compose.yml`, `docker/postgres/init.sql`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`, `src/db/client.ts`, `tests/integration/helpers/db.ts`, `tests/integration/global-setup.ts`
- Test: `tests/integration/db/composite-fk.test.ts`

**Interfaces:**
- Produces: `db` (Prisma client on `DATABASE_URL` via `@prisma/adapter-pg`, singleton, `import "server-only"`); generated client at `src/generated/prisma`. Test helpers: `adminDb` (as `trask_migrator`), `appDb` (as `trask_app`), `resetDb(): Promise<void>` (TRUNCATE all app tables CASCADE as migrator), `createUser(overrides?): Promise<User>`.
- Prisma enums: `WorkspaceRole { OWNER ADMIN MEMBER VIEWER }`, `ColumnKind { BACKLOG TODO IN_PROGRESS REVIEW DONE }`, `TaskPriority { NONE LOW MEDIUM HIGH URGENT }`.

- [ ] **Step 1:** `docker-compose.yml`: service `db`, image `postgres:18-alpine`, port `5433:5432`, healthcheck `pg_isready`, mounts `docker/postgres/init.sql`. `init.sql` creates `trask_migrator` (LOGIN, owns database `trask_test`) and `trask_app` (LOGIN, `NOBYPASSRLS`, `NOSUPERUSER`, `NOCREATEROLE`), with test-only passwords matching `.env.test`.
- [ ] **Step 2:** `prisma/schema.prisma` with every model from spec §3 (Workspace, WorkspaceMember, Board, Column, Task, Label, TaskLabel, ChecklistItem, Comment, Attachment, Activity, AuditEvent) plus `User` (id, email `@unique`, name, emailVerified, image, timestamps). Rules:
  - every tenant model has `workspaceId` and `@@unique([id, workspaceId])`;
  - child → parent relations use `fields: [parentId, workspaceId], references: [id, workspaceId]` (Column→Board, Task→Board, Task→Column, TaskLabel→Task/Label, ChecklistItem→Task, Comment→Task, Attachment→Task, Task→Task parent);
  - user references (`assigneeId`, `authorId`, `actorId`, `createdById`, `uploaderId`) are nullable with `onDelete: SetNull`;
  - indexes from spec §3; `Task @@unique([workspaceId, number])`; `Label @@unique([workspaceId, name])`; `WorkspaceMember @@unique([workspaceId, userId])` + `@@index([userId])`.
- [ ] **Step 3:** Generate the migration with `prisma migrate dev --create-only`, then hand-edit the `Task.parentTaskId` FK to `ON DELETE SET NULL ("parentTaskId")` (PG15+ column list, so `workspaceId` is not nulled). Append grants: `GRANT USAGE ON SCHEMA public TO trask_app;` `SELECT, INSERT, UPDATE, DELETE` on all tables except Activity (`SELECT, INSERT`) and AuditEvent (`INSERT`); `ALTER DEFAULT PRIVILEGES FOR ROLE trask_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trask_app;`
- [ ] **Step 4: Write the failing tests** `composite-fk.test.ts` (as `adminDb`): with workspaces W1 and W2, creating a Task in W1 whose `columnId` belongs to W2 → rejected (FK violation); same for TaskLabel linking a W2 label; deleting a parent task sets the child's `parentTaskId` to null and keeps its `workspaceId`; deleting W1 cascades its boards, columns and tasks.
- [ ] **Step 5:** `pnpm db:test:up && pnpm test:integration` → FAIL before the migration is applied (global setup runs `prisma migrate deploy` with `MIGRATION_DATABASE_URL` from `.env.test`), PASS after.
- [ ] **Step 6: Commit** — `feat(db): add tenant schema with composite foreign keys and least-privilege grants`

---

### Task 9: Row-Level Security and tenant-scoped client

**Files:**
- Create: `prisma/migrations/<ts>_rls/migration.sql`, `src/db/tenant.ts`, `src/server/workspaces/membership-repository.ts`, `src/server/seed/guard.ts`, `prisma/seed.ts`, `scripts/verify-db-roles.ts`
- Test: `tests/integration/db/rls.test.ts`, `tests/integration/workspaces/membership-repository.test.ts`, `tests/unit/server/seed-guard.test.ts`

**Interfaces:**
- Consumes: `db`, test helpers (Task 8); `Role` (Task 6).
- Produces: SQL `app.current_user_id(): uuid` (`nullif(current_setting('app.user_id', true), '')::uuid`); `app.is_member(ws uuid): boolean` (`SECURITY DEFINER`, `STABLE`, `SET search_path = public, pg_temp`, owned by `trask_migrator`); `app.create_workspace(p_name text, p_slug text): uuid` (`SECURITY DEFINER`; raises if no current user; inserts Workspace + OWNER membership). TS: `withTenant(ctx: { userId: string }): TenantDb` (Prisma `$extends` wrapping every operation in `$transaction([set_config('app.user_id', userId, true), query])`); `createWorkspace(ctx: { userId: string }, input: { name: string; slug: string }): Promise<{ id: string }>`; `findMembershipRole(ctx: { userId: string }, workspaceId: string): Promise<Role | null>`; `assertSeedAllowed(nodeEnv: string): void`.
- Policies: on every tenant table `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY tenant_isolation … USING (app.is_member("workspaceId")) WITH CHECK (app.is_member("workspaceId"))`; Workspace uses `app.is_member(id)` and has no INSERT policy (creation only via `app.create_workspace`). `GRANT EXECUTE` on the three functions to `trask_app`.

- [ ] **Step 1: Write the failing tests** `rls.test.ts` (as `appDb` through `withTenant`), with User A owning W_A (with a board) and User B owning W_B:
  - `member sees own workspace rows` → A sees W_A's board.
  - `other tenant sees nothing` → B reading boards gets only W_B's, and `findFirst({ where: { id: boardOfA } })` → `null`.
  - `cannot write into another workspace` → B creating a board with `workspaceId: W_A` → rejected.
  - `no context returns no rows` → bare `appDb.board.findMany()` → `[]` (Review Focus 1).
  - `tenant context does not leak across queries` → run `withTenant(A)` query, then bare `appDb.board.findMany()` on the same pool → `[]` (Review Focus 2).
  - `app role cannot bypass RLS` → `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user` → `false`, and `current_user` does not own `"Board"`.
  - `audit events are append-only` → `appDb` update/delete/select on AuditEvent → permission denied.
- [ ] **Step 2:** `membership-repository.test.ts`: `createWorkspace` returns an id and A's role there is `OWNER`; `findMembershipRole(B, W_A)` → `null`.
- [ ] **Step 3:** `seed-guard.test.ts`: `assertSeedAllowed("production")` throws; `"development"` and `"test"` pass.
- [ ] **Step 4:** Run → FAIL. **Step 5:** Write the RLS migration, `tenant.ts`, repository, guard. `prisma/seed.ts` calls `assertSeedAllowed(process.env.NODE_ENV ?? "")` first; demo data arrives in Phase 1. `scripts/verify-db-roles.ts` runs the bypass/ownership checks against any `DATABASE_URL` (used once against Neon `dev` in Step 7). **Step 6:** Run → PASS.
- [ ] **Step 7:** `pnpm db:deploy` against Neon `dev` (migrator URL), then `pnpm tsx scripts/verify-db-roles.ts` with the Neon `trask_app` URL → prints `trask_app: rolbypassrls=false, owner=false`.
- [ ] **Step 8: Commit** — `feat(db): enforce tenant isolation with row-level security`

---

### Task 10: `createAction` — the only way to define a Server Action

**Files:**
- Create: `src/server/ports/auth.ts`, `src/server/actions/action-brand.ts`, `src/server/actions/create-action.ts`
- Test: `tests/unit/server/create-action.test.ts`, `tests/unit/server/actions-wrapped.test.ts`, `tests/fixtures/actions/mixed.ts`

**Interfaces:**
- Consumes: errors + `toSafeError` (Task 4), `Logger` (Task 5), `Role`/`Permission`/`assertCan` (Task 6), `findMembershipRole` signature (Task 9).
- Produces:
  - `interface AuthPort { getSession(): Promise<{ userId: string; emailVerified: boolean } | null> }` (real implementation in Phase 1).
  - `type AuthContext = { userId: string }`; `type WorkspaceCtx = { userId: string; workspaceId: string; role: Role }`.
  - `createActionFactory(deps: { auth: AuthPort; findRole: (ctx: AuthContext, workspaceId: string) => Promise<Role | null>; logger: Logger }) => createAction`.
  - `createAction` overloads, each returning a branded `(input: unknown) => Promise<Result<T>>`:
    - `{ input: ZodObject; permission: Permission; workspaceId: (input) => string; handler: (ctx: WorkspaceCtx, input) => Promise<T> }`
    - `{ input: ZodObject; authenticated: true; handler: (ctx: AuthContext, input) => Promise<T> }`
    - `{ input: ZodObject; public: true; handler: (ctx: { userId: string | null }, input) => Promise<T> }`
  - `isAction(value: unknown): boolean`; `findUnwrappedExports(mod: Record<string, unknown>): string[]` (exported functions that are not branded).
- Order inside the wrapper: session → email verified → `input.strict().safeParse` → role lookup → `assertCan` → handler → `toSafeError`. Unexpected errors are logged with `{ action: name, userId }` and never returned raw.

- [ ] **Step 1: Write the failing tests** (`create-action.test.ts`, with fake auth/findRole and an in-memory logger):
  - no session → `{ ok: false, error.code: "AUTHENTICATION" }`, handler not called.
  - unverified email → `AUTHENTICATION`, message `"Verify your email to continue."`.
  - unknown input key `{ title: "x", role: "OWNER" }` → `VALIDATION` (mass assignment blocked).
  - not a member → `NOT_FOUND` (not `AUTHORIZATION`).
  - VIEWER calling a `task.create` action → `AUTHORIZATION`.
  - MEMBER → `{ ok: true, data }`, and the handler received `ctx.role === "MEMBER"` from `findRole`, never from input.
  - handler throws `new Error("db exploded")` → `INTERNAL`, message has no `"db exploded"`, logger received one error entry.
  - `public: true` action with no session → handler receives `{ userId: null }`.
- [ ] **Step 2:** `actions-wrapped.test.ts`: `findUnwrappedExports(fixture)` → `["rawExport"]` for the fixture; then glob `src/features/**/actions/*.ts`, import each, assert `findUnwrappedExports(mod)` is `[]` (zero files in Phase 0 is a pass; the guard is live from Phase 1).
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. **Step 5:** Run → PASS.
- [ ] **Step 6: Commit** — `feat(actions): add default-deny createAction wrapper`

---

### Task 11: Web hardening — proxy, headers, health, security.txt

**Files:**
- Create: `src/server/http/security-headers.ts`, `src/server/http/public-paths.ts`, `src/proxy.ts`, `src/app/api/health/route.ts`, `public/.well-known/security.txt`
- Test: `tests/unit/server/security-headers.test.ts`, `tests/unit/server/public-paths.test.ts`

**Interfaces:**
- Consumes: `safeRedirectPath` (Task 7).
- Produces: `buildCsp(nonce: string, opts: { dev: boolean }): string`; `securityHeaders(): Record<string, string>`; `isPublicPath(pathname: string): boolean`; `isBlockedPath(pathname: string): boolean`; `hasSessionCookie(cookies: { has(name: string): boolean }): boolean` (checks `better-auth.session_token` and `__Secure-better-auth.session_token`).

CSP (exact directives): `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'{dev: 'unsafe-eval'}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`. (`'unsafe-inline'` styles is a deliberate trade-off for Tailwind/Radix inline styles; recorded in the threat model.)

Public allowlist: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/legal/*`, `/api/health`, `/api/auth/*`, `/.well-known/security.txt`, `/dev/ui` (development only), and Next static assets.

Blocked (404): any path segment starting with `.` except `/.well-known/`, and any path ending in `.map`, `.zip`, `.tar`, `.gz`, `.bak`, `.sql`, `.env`.

- [ ] **Step 1: Write the failing tests:** `buildCsp("abc", { dev: false })` contains `'nonce-abc'`, `frame-ancestors 'none'`, `object-src 'none'`, and not `unsafe-eval`; with `dev: true` it contains `'unsafe-eval'`. `securityHeaders()` has exact HSTS/nosniff/Referrer-Policy/Permissions-Policy (`camera=(), microphone=(), geolocation=(), payment=()`)/`Cross-Origin-Opener-Policy: same-origin` values and **no** `Access-Control-Allow-Origin`. `isPublicPath`: `/` true, `/w/acme` false, `/api/auth/sign-in` true, `/api/tasks` false. `isBlockedPath`: `/.env`, `/.git/config`, `/backup.zip`, `/_next/static/x.js.map` true; `/.well-known/security.txt` false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement helpers; `proxy.ts` generates a nonce per request (`crypto.randomUUID()` base64), sets CSP + headers, returns 404 for blocked paths, sets `Cache-Control: private, no-store` on non-public paths, and redirects non-public paths without a session cookie to `/sign-in?next=<safeRedirectPath(path)>`. The root layout reads the nonce from the request header and passes it to next-themes. Health route: `GET` → `{ status: "ok" }` (200) or `{ status: "degraded" }` (503) after a `SELECT 1` with a 2 s timeout, `Cache-Control: no-store`, nothing else. `security.txt`: `Contact: https://github.com/renzfeliciano/trask/security/advisories/new`, `Expires` one year out, `Preferred-Languages: en`, `Policy:` link to `SECURITY.md` on GitHub. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(security): add nonce CSP, security headers, and default-deny proxy`

---

### Task 12: Design system foundation

**Files:**
- Create: `src/app/globals.css`, `components.json`, `src/components/providers/theme-provider.tsx`, `src/components/ui/{button,input,dialog,sheet,sonner,skeleton,empty-state,error-state,theme-toggle}.tsx`, `src/app/dev/ui/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `docs/content-style.md`
- Test: `tests/unit/design/contrast.test.ts`, `tests/unit/design/empty-error-state.test.tsx`, `tests/unit/content/banned-phrases.test.ts`

**Interfaces:**
- Produces: CSS custom properties (both themes) `--background`, `--foreground`, `--surface`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--primary`, `--primary-foreground`, `--accent`, `--success`, `--warning`, `--danger`, `--danger-foreground`, `--info`, `--label-1`…`--label-10`, `--radius-sm|md|lg`, `--shadow-1|2|3`, `--duration-fast|base` (0ms under `prefers-reduced-motion`), mapped into Tailwind v4 via `@theme inline`. `EmptyState({ title, description, action? })`; `ErrorState({ title?, description, onRetry? })` (`role="alert"`, retry button label "Try again"); `ThemeToggle` (accessible label "Switch theme").
- Values: exactly the light/dark table in spec §5 "Tokens" (brand board palette). Token names add `--primary-text`, `--secondary`, `--highlight` to the list above; `--accent` is the violet tint `#C4B5FD`/`#2E2650`. The brand gradient is exposed only as `--brand-gradient` and used only by `LogoMark` and the landing hero.

- [ ] **Step 1: Write the failing tests:**
  - `contrast.test.ts`: parse `globals.css` for `:root` and `.dark`; using `colorjs.io` WCAG 2.1 contrast assert ≥ 4.5 for `foreground/background`, `foreground/surface`, `muted-foreground/background`, `primary-foreground/primary`, `primary-text/background`, `danger-foreground/danger`, `foreground/highlight`, `foreground/secondary`; ≥ 3 for `ring/background`; `border` is excluded (decorative). Both themes. Plus one negative assertion documenting the rule: `secondary` on `surface` is < 4.5 (fills only).
  - `empty-error-state.test.tsx` (jsdom, Testing Library): EmptyState renders title, description and action; ErrorState has `role="alert"` and clicking "Try again" calls `onRetry` once.
  - `banned-phrases.test.ts`: read the fenced ```banned``` list in `docs/content-style.md`; fast-glob `src/**/*.{ts,tsx}` (posix paths, LF-normalized); fail listing `file: phrase` for any case-insensitive match. List: unlock, supercharge, seamless, seamlessly, effortless, effortlessly, elevate, revolutionize, game-changer, dive in, lorem ipsum, 🚀, ✨.
- [ ] **Step 2:** Run → FAIL. **Step 3:** `shadcn init` + add primitives; restyle them to the tokens (3 radii, borders over shadows); write EmptyState/ErrorState/ThemeToggle; Geist via the `geist` package; next-themes with `attribute="class"`, system default, nonce passed through. `/dev/ui` shows every primitive and state in both themes and calls `notFound()` when `NODE_ENV === "production"`. `not-found.tsx` and `error.tsx` use EmptyState/ErrorState with plain copy ("We couldn't find that page." / "Something went wrong on our side." + "Try again"). **Step 4:** Run → PASS. Check `/dev/ui` at 375 px and 1280 px, light and dark, against spec §5 "Quality bar".
- [ ] **Step 5: Commit** — `feat(ui): add brand-board tokens, theming, and core primitives`

---

### Task 12b: Brand mark and mascot system

**Files:**
- Create: `src/components/brand/logo-mark.tsx`, `src/components/brand/wordmark.tsx`, `src/components/brand/mascot.tsx`, `src/components/brand/mascot-manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/manifest.ts`, `public/brand/mascot/README.md`
- Modify: `src/components/ui/empty-state.tsx`, `src/components/ui/error-state.tsx`, `src/app/(marketing)/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/dev/ui/page.tsx`
- Test: `tests/unit/brand/mascot.test.tsx`

**Interfaces:**
- Consumes: tokens, EmptyState, ErrorState (Task 12).
- Produces: `type MascotState = "welcome" | "empty" | "creating" | "done" | "searching" | "no-results" | "focus" | "error"`; `MASCOT_MANIFEST: Record<MascotState, { light: string | null; dark: string | null }>` (paths under `/brand/mascot/`; `light` points at the interim WebP files delivered with this plan — copy `brand/mascot-interim/*.webp` to `public/brand/mascot/`; `dark` is `null` until dark exports exist, so dark mode reuses `light`); `<Mascot state size?: "sm" | "md" | "lg" />` (40 / 120 / 160 px); `<LogoMark className? />` (SVG, `currentColor`); `<Wordmark />`. `EmptyState` and `ErrorState` gain optional `mascot?: MascotState`.

- [ ] **Step 1: Write the failing tests** (`mascot.test.tsx`, jsdom):
  - every `MascotState` has a manifest entry (compile-time `Record` + runtime key check against the spec's 8 states);
  - `<Mascot state="empty" />` with a `null` asset renders the `LogoMark` fallback;
  - with an asset, it renders an `img` with `alt=""` and `aria-hidden="true"`;
  - in dark theme it uses the `dark` path when present, else `light`;
  - `EmptyState` with `mascot="empty"` still renders title and description as text (meaning never only in the image).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. `LogoMark`: rounded-square app icon with the "T" glyph, drawn as SVG paths (no font dependency). `icon.svg`/`apple-icon.png`/`manifest.ts` (name "TRASK", `theme_color` from `--primary`, 192/512 maskable icons) generated from the same SVG. Landing page: wordmark + tagline "Work moves here." + `<Mascot state="welcome" size="lg" />`. `not-found.tsx` / `error.tsx` use `mascot="error"` with the exact copy from spec §5 "Brand & mascot". `public/brand/mascot/README.md` lists the expected filenames (`<state>.webp`, `<state>-dark.webp`), 3× export size, transparent background, ≤ 30 KB. **Step 4:** Run → PASS; review `/dev/ui` mascot gallery at 375 px and 1280 px, light and dark.
- [ ] **Step 5: Commit** — `feat(brand): add logo mark, app icons, and mascot state system`

---

### Task 13: End-to-end harness (mobile first)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/security.spec.ts`

**Interfaces:**
- Consumes: everything above, via a production build.
- Produces: Playwright projects in this order: `mobile-chrome` (Pixel 7), `mobile-safari` (iPhone 15), `desktop-chrome`. `webServer`: `pnpm build && pnpm start -p 3100` with `.env.test`.

- [ ] **Step 1: Write the failing tests:**
  - smoke: `/` returns 200 and shows heading "TRASK"; axe (`@axe-core/playwright`) finds 0 violations in light and in dark (`emulateMedia({ colorScheme })`); no console messages matching `Content Security Policy` (Review Focus 3); clicking "Switch theme" toggles the `dark` class on `<html>`.
  - security: response headers match Task 11 values, contain a `nonce-` CSP and no `x-powered-by` / `access-control-allow-origin`; `/.env`, `/.git/config`, `/backup.zip`, `/_next/static/chunks/main.js.map` → 404; `/dev/ui` → 404; `/api/health` → `{"status":"ok"}` with `no-store`; `/w/acme` without cookie → redirects to `/sign-in?next=%2Fw%2Facme`; `/sign-in?next=//evil.com` style values never produce an off-site `Location`.
- [ ] **Step 2:** Run `pnpm e2e` → FAIL where not yet wired, then fix wiring (not tests) until PASS on all three projects.
- [ ] **Step 3: Commit** — `test(e2e): add mobile-first smoke and security suites`

---

### Task 14: Client bundle secret scan

**Files:**
- Create: `scripts/check-client-bundle.ts`
- Test: `tests/unit/scripts/check-client-bundle.test.ts`

**Interfaces:**
- Produces: `findLeaks(files: { path: string; content: string }[], secretValues: string[]): { path: string; reason: string }[]`; CLI (`pnpm check:bundle`) reads `.next/static/**` and uses every env value whose key is not `NEXT_PUBLIC_*` and length ≥ 8 as `secretValues`, plus the literal key names `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `ENCRYPTION_KEY`. Exits 1 on any leak, printing path + reason (never the secret).

- [ ] **Step 1: Write the failing tests:** a file containing a secret value is reported; a file containing `DATABASE_URL` is reported; clean files → `[]`; the reported `reason` never contains the secret value.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS, then `pnpm build && pnpm check:bundle` → exit 0.
- [ ] **Step 5: Commit** — `feat(security): scan client bundle for leaked secrets`

---

### Task 15: CI, supply chain, commit hooks

**Files:**
- Create: `.github/workflows/ci.yml`, `renovate.json`, `.gitleaks.toml`, `.husky/pre-commit`, `.lintstagedrc.json`, `SECURITY.md`

**Interfaces:**
- Consumes: all scripts from Task 1, `check:bundle` (Task 14).

- [ ] **Step 1:** `ci.yml` (on push to `main` and PRs; `permissions: contents: read`; every third-party action pinned by commit SHA; Node from `.nvmrc`; pnpm cache; `pnpm install --frozen-lockfile`):
  - `checks`: lint → typecheck → `pnpm test` → knip.
  - `integration`: `postgres:18-alpine` service, apply `docker/postgres/init.sql` with `psql`, `pnpm test:integration`.
  - `build`: `pnpm build` → `pnpm check:bundle`.
  - `e2e` (PRs to `main`, needs build + integration): same Postgres service + `init.sql` + `pnpm db:deploy`, install Playwright browsers, `pnpm e2e`, upload report on failure.
  - `security` (parallel): gitleaks with `fetch-depth: 0` (full history); `pnpm audit --prod --audit-level high`; Semgrep OSS `--config p/typescript --config p/nextjs --config p/owasp-top-ten --error`.
- [ ] **Step 2:** `renovate.json` per spec §8: `config:recommended`, `helpers:pinGitHubActionDigests`, `minimumReleaseAge: "3 days"`, weekly schedule (`Asia/Singapore`, Monday before 6am), dependency dashboard, vulnerability alerts immediate, groups (next + eslint-config-next; prisma/@prisma/*; react/react-dom/@types/react*; @dnd-kit/*; @playwright/test + postgres image; eslint family), automerge only devDependency patch/minor, majors never automerge.
- [ ] **Step 3:** `.gitleaks.toml` extends defaults and allowlists only `.env.test`. Husky `pre-commit` runs lint-staged (`eslint --fix` + `prettier --write` on staged files). `SECURITY.md`: how to report (GitHub private advisory), response target (acknowledge within 7 days), scope, no public disclosure before a fix.
- [ ] **Step 4:** Push a branch, open a PR → all jobs green. Enable branch protection on `main` requiring every job.
- [ ] **Step 5: Commit** — `ci: add pipeline, Renovate, gitleaks, Semgrep, and commit hooks`

---

### Task 16: Documentation and Learning write-up

**Files:**
- Create: `README.md`, `docs/architecture.md`, `docs/upgrading.md`, `docs/decisions/0001-modular-monolith-server-actions.md`, `0002-neon-postgres-and-driver.md`, `0003-better-auth.md`, `0004-tenant-isolation-composite-fk-and-rls.md`, `0005-mobile-first.md`, `0006-ports-and-adapters.md`, `0007-version-and-upgrade-policy.md`, `0008-no-ai-slop-quality-bar.md`, `docs/security/threat-model.md`, `docs/security/controls.md`, `docs/security/secret-rotation.md`, `docs/learning/phase-0.md`, `docs/superpowers/specs/2026-10-08-trask-foundation-design.md` (spec + "Spec amendments" from this plan), `docs/superpowers/plans/2026-10-08-trask-phase-0-foundation.md` (this plan)

- [ ] **Step 1:** README: what TRASK is (two sentences), stack, prerequisites, setup (clone → `.env` from example → `pnpm i` → `pnpm db:test:up` → `pnpm db:deploy` → `pnpm dev`), every script, testing, deployment outline, links to architecture/ADRs/security. A new developer must succeed using only the README.
- [ ] **Step 2:** ADRs: context, decision, rejected alternatives, consequences — each under one page.
- [ ] **Step 3:** Threat model: STRIDE table for Phase 0 surfaces (proxy, Server Action wrapper, DB roles/RLS, env/secrets, CI supply chain), including the `'unsafe-inline'` styles trade-off. `controls.md`: spec Appendix A with Phase 0 rows marked done and evidence (test file names).
- [ ] **Step 4:** `docs/learning/phase-0.md` in the spec's Learning-mode format (What we built / Why this architecture / Trade-offs / Security / What to learn / Improve later), tied to actual files.
- [ ] **Step 5:** Final verification: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build && pnpm check:bundle && pnpm e2e` all pass; app refuses to boot with `DATABASE_URL` removed; manual two-account check is noted as "n/a until Phase 1 sign-in" in `controls.md`.
- [ ] **Step 6: Commit** — `docs: add README, ADRs, threat model, and Phase 0 learning notes`
