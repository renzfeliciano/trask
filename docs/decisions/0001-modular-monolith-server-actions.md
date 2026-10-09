# ADR 0001: Modular monolith with Server Actions behind `createAction`

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

TRASK is built by one person, deployed on Vercel Hobby, and must still make an unguarded endpoint or an
unscoped query hard to write. Every write needs the same checks: session, verified email, strict input,
workspace role, permission, safe errors.

## Decision

- One Next.js app. Pages read in Server Components; writes are Server Actions. Server code is split into
  modules under `src/server/<module>/` (service, repository, policy).
- `createAction` (`src/server/actions/create-action.ts`) is the only way to define a Server Action. It is
  one generic function over a discriminated config: exactly one of `permission`, `authenticated: true` or
  `public: true`, checked at definition time. Each action has a `name` used only in logs.
- Lint enforces the layering (`eslint-plugin-boundaries`): only repositories import `src/db`; routes and
  actions never import repositories. `tests/unit/lint-rules.test.ts` proves each rule fires.
- A unit test (`tests/unit/server/actions-wrapped.test.ts`) fails if a module under
  `src/features/**/actions/` exports a function that `createAction` did not build.

## Rejected alternatives

- **Separate API service (REST/tRPC) or microservices:** a second deployable and a client contract to
  maintain, with no scaling need to justify it.
- **Route handlers for writes:** each handler would repeat the checks; Server Actions plus one wrapper
  centralize them and get Next's origin check for free.
- **Overloaded `createAction` signatures:** the lint config rejects overloads, and a discriminated union
  gives the same type safety.

## Consequences

- Unknown top-level input keys are rejected (mass-assignment guard); unknown nested keys are stripped
  silently rather than reported.
- An unverified session is treated as signed out, also in `public` actions. Phase 1 may add an explicit
  mode for flows that need the unverified user.
- Unexpected errors are logged as `{ action, userId, errorName, errorCode }` only, never the error object
  or input, which costs debug detail.
- The security bans (`dangerouslySetInnerHTML`, raw-unsafe SQL, `child_process`, role equality) apply to
  `src/**`. `scripts/`, `prisma/` and `tests/` may use raw SQL and `child_process` (the integration setup
  runs `prisma migrate deploy` that way). Code there is never bundled into the app, but it gets no lint
  protection, so reviews must cover it.
- Files directly under `src/` that no folder rule classifies (`src-other`, for example
  `instrumentation.ts`) may be imported by every layer and may import `lib`, `config` and non-repository
  server code. That is wider than the layer table in `docs/architecture.md`; per-element grants would
  tighten it.
- `brandAction` (`src/server/actions/action-brand.ts`) is exported, so any module could mark a raw
  handler as wrapped and pass the guard test. It should be private to `create-action.ts` (fix-before-merge).
- The wrapped-action test only finds actions in the `actions/` folders; a `"use server"` file elsewhere
  would escape it. Widening the scan to every `"use server"` file is planned (folder conventions are not
  a security boundary).
