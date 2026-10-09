# Security controls matrix

Source: spec Appendix A. **Phase** is where a control is built and tested; **Rule** is written policy
enforced in review or lint; **N/A** does not apply (reason given). **Status** is the state at the end of
Phase 0 (2026-10-09). Evidence paths are tests unless marked otherwise. Update this page every phase.

## Access control

| Control                  | Phase | Status            | How / evidence                                                                                                                                                                                                                                  |
| ------------------------ | ----- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS, never `*`          | P0    | Done              | No CORS headers at all. `tests/unit/server/security-headers.test.ts`, `tests/e2e/security.spec.ts`                                                                                                                                              |
| SameSite cookies (CSRF)  | P1    | Planned           | `SameSite=Lax` + Server Action origin check + Better Auth `trustedOrigins`                                                                                                                                                                      |
| Row-Level Security       | P0    | Done              | `prisma/migrations/20261008093000_rls`. `tests/integration/db/rls.test.ts`                                                                                                                                                                      |
| Scoped queries           | P0    | Done (foundation) | `withTenant` + RLS. `tests/integration/db/rls.test.ts` ("no context returns no rows"), `tests/integration/workspaces/membership-repository.test.ts`. The per-repository isolation registry (spec §7) starts with the first domain repositories. |
| Server-side gates        | P0    | Done              | `createAction` + `assertCan`. `tests/unit/server/create-action.test.ts`, `tests/unit/server/actions-wrapped.test.ts`                                                                                                                            |
| Static files ignore auth | P0/P5 | Done (P0 part)    | `public/` holds only brand art and `security.txt` (file review). Attachments: P5                                                                                                                                                                |
| 404 instead of 403       | P0    | Done              | Non-members and malformed workspace ids get NOT_FOUND. `tests/unit/server/create-action.test.ts`                                                                                                                                                |

## Roles & permissions

| Control                     | Phase  | Status  | How / evidence                                                                                                                              |
| --------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side RBAC            | P0     | Done    | `PERMISSION_MIN_ROLE` + `assertCan`. `tests/unit/server/authz.test.ts` (every role × permission)                                            |
| Never read role from client | P0     | Done    | Role from `findRole` each call. `tests/unit/server/create-action.test.ts` ("…never from input")                                             |
| Block mass assignment       | P0     | Done    | Zod `.strict()`. `tests/unit/server/create-action.test.ts` ("blocks mass assignment…")                                                      |
| Rank roles, don't compare   | P0     | Done    | `ROLE_RANK` + `atLeast()`. `tests/unit/server/authz.test.ts`, `tests/unit/lint-rules.test.ts`                                               |
| Default deny                | P0     | Done    | One access mode per action; proxy allowlist. `create-action.test.ts`, `proxy.test.ts`, `public-paths.test.ts` (all in `tests/unit/server/`) |
| Re-check role per request   | P0     | Done    | No role in session; lookup per action call. `tests/unit/server/create-action.test.ts`                                                       |
| Least privilege for staff   | Rule   | Rule    | No platform-staff role exists                                                                                                               |
| Separate role from plan     | Rule   | Rule    | No plans exist                                                                                                                              |
| Log privileged actions      | P1/P10 | Planned | `AuditEvent` table and insert-only grant exist (`tests/integration/db/grants.test.ts`); nothing writes yet                                  |

## Accounts

| Control                                  | Phase  | Status                                                                    |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Password hashing (scrypt)                | P1     | Planned                                                                   |
| Minimum length + breached list (HIBP)    | P1     | Planned                                                                   |
| httpOnly cookies                         | P1     | Planned                                                                   |
| Session expiry + fresh session at login  | P1     | Planned                                                                   |
| Email verification at session validation | P1     | Planned (`createAction` already treats unverified sessions as signed out) |
| No account enumeration                   | P1     | Planned                                                                   |
| Kill sessions on password reset          | P1     | Planned                                                                   |
| Timing-safe comparison                   | P1     | Helper done: `safeEqual`, `tests/unit/server/crypto.test.ts`              |
| MFA option                               | P1     | Planned                                                                   |
| Self-service account deletion            | P1/P10 | Planned                                                                   |

## Abuse & cost

| Control                           | Phase    | Status                                                |
| --------------------------------- | -------- | ----------------------------------------------------- |
| Rate limiting per IP and per user | P1 (+P5) | Planned                                               |
| Persisted counters                | P1       | Planned                                               |
| Brute-force alerts                | P1       | Planned                                               |
| Spend caps                        | N/A now  | No paid APIs; caps are mandatory before any are added |
| Storage caps (lifetime)           | P5       | Planned                                               |
| Honeypot field                    | P1       | Planned                                               |
| Disposable email blocking         | P1       | Planned                                               |

## Input & files

| Control                     | Phase | Status         | How / evidence                                                                                          |
| --------------------------- | ----- | -------------- | ------------------------------------------------------------------------------------------------------- |
| Server-side validation      | P0    | Done           | Zod in `createAction` and `src/config/env.ts`. `create-action.test.ts`, `tests/unit/config/env.test.ts` |
| Parameterized queries       | P0    | Done           | Raw-unsafe Prisma calls banned in `src/**`. `tests/unit/lint-rules.test.ts`                             |
| Command injection           | P0    | Done           | `child_process` banned in `src/**`. `tests/unit/lint-rules.test.ts`                                     |
| Magic-byte checks           | P5    | Planned        |                                                                                                         |
| Beyond magic bytes          | P5    | Planned        |                                                                                                         |
| Check limits before reading | P0/P5 | Done (P0 part) | Server Actions `bodySizeLimit: "1mb"` in `next.config.ts` (config, no test)                             |
| No paths from user input    | P5    | Planned        |                                                                                                         |
| Sanitize HTML (DOMPurify)   | P5    | Rule for now   | No HTML rendering; `dangerouslySetInnerHTML` banned (`tests/unit/lint-rules.test.ts`)                   |
| No open redirects           | P1    | Done early     | `safeRedirectPath`. `tests/unit/lib/safe-redirect.test.ts`, `tests/e2e/security.spec.ts`                |
| SSRF protection             | Rule  | Rule           | No server-side fetching of user URLs                                                                    |

## AI features

| Control                                                                 | Phase           | Status |
| ----------------------------------------------------------------------- | --------------- | ------ |
| Prompt injection, limited tools, no other users' data, untrusted output | Rule (deferred) | Rule   |

## Browser & headers

| Control              | Phase  | Status         | How / evidence                                                                                                           |
| -------------------- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| HTTPS everywhere     | P0/P12 | Done (P0 part) | HSTS + `upgrade-insecure-requests`; Vercel TLS at deploy. `tests/unit/server/security-headers.test.ts`                   |
| CSP with nonces      | P0     | Done           | `security-headers.test.ts`, `proxy.test.ts`; `tests/e2e/smoke.spec.ts` (no CSP violations), `tests/e2e/security.spec.ts` |
| HSTS                 | P0     | Done           | No preload. `security-headers.test.ts`, `tests/e2e/security.spec.ts`                                                     |
| frame-ancestors none | P0     | Done           | `security-headers.test.ts`, `tests/e2e/security.spec.ts`                                                                 |
| nosniff              | P0     | Done           | `security-headers.test.ts`, `tests/e2e/security.spec.ts`                                                                 |
| Cache-Control        | P0     | Done           | `private, no-store` behind sign-in. `proxy.test.ts`, `tests/e2e/security.spec.ts`                                        |
| No stack traces      | P0     | Done           | `toSafeError`; generic `error.tsx`. `tests/unit/server/errors.test.ts`                                                   |
| Remove X-Powered-By  | P0     | Done           | `poweredByHeader: false`. `tests/e2e/security.spec.ts`                                                                   |

## Secrets

| Control                       | Phase     | Status      | How / evidence                                                                                                                                                                                          |
| ----------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env vars only + history check | P0        | Done        | Zod env, value-free errors: `tests/unit/config/env.test.ts`. gitleaks full history in CI. `src/instrumentation.ts` exits at server start on an invalid env: `tests/unit/config/instrumentation.test.ts` |
| No secrets in frontend        | P0        | Done        | `pnpm check:bundle` in CI. `tests/unit/scripts/check-client-bundle.test.ts`                                                                                                                             |
| Block dotfiles/backups        | P0        | Done        | `tests/unit/server/public-paths.test.ts`, `proxy.test.ts`, `tests/e2e/security.spec.ts`                                                                                                                 |
| Sourcemaps off in prod        | P0        | Done        | `productionBrowserSourceMaps: false`; `.map` 404 in `tests/e2e/security.spec.ts`                                                                                                                        |
| Least-privilege DB user       | P0        | Done        | `tests/integration/db/grants.test.ts`, `tests/integration/db/rls.test.ts`; `scripts/verify-db-roles.ts` for Neon                                                                                        |
| Encrypt third-party tokens    | P0 / Rule | Helper done | AES-256-GCM `src/server/crypto/encryption.ts`. `tests/unit/server/crypto.test.ts`                                                                                                                       |
| No custom crypto              | Rule      | Rule        | Node `crypto` only                                                                                                                                                                                      |
| Rotate leaked secrets         | P0        | Done        | `docs/security/secret-rotation.md`                                                                                                                                                                      |

## Infrastructure

| Control                   | Phase | Status  | How / evidence                                                                                                                             |
| ------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No test/default accounts  | P0    | Done    | Seed refused outside development/test. `tests/unit/server/seed-guard.test.ts`                                                              |
| No public debug endpoints | P0    | Done    | `/dev/ui` 404 in production; health returns status only. `proxy.test.ts`, `tests/unit/server/health.test.ts`, `tests/e2e/security.spec.ts` |
| Firewall origin           | N/A   | N/A     | Vercel-hosted, no exposed origin                                                                                                           |
| Memory cap                | P12   | Planned |                                                                                                                                            |
| Update dependencies       | P0    | Done    | `renovate.json`, `pnpm-workspace.yaml` release age, `pnpm audit` in CI (Renovate app: user step)                                           |
| Offsite encrypted backups | P12   | Planned |                                                                                                                                            |
| Test restores             | P12   | Planned |                                                                                                                                            |
| Audit log                 | P1    | Planned | Table + insert-only grant ready                                                                                                            |
| No personal data in logs  | P0    | Done    | `tests/unit/server/pino-logger.test.ts`; allow-listed action logs in `create-action.test.ts`                                               |
| Alerting                  | P12   | Planned |                                                                                                                                            |
| Security contact          | P0    | Done    | `SECURITY.md`, `public/.well-known/security.txt` (private reporting must be enabled: README)                                               |

## Legal pages and money

| Control                                                              | Phase   | Status   |
| -------------------------------------------------------------------- | ------- | -------- |
| Terms, Privacy, sub-processors, cookie disclosure                    | P12     | Planned  |
| Refund policy                                                        | N/A     | Free app |
| Data processing terms                                                | P12     | Planned  |
| Export & deletion                                                    | P10/P12 | Planned  |
| One access path, server totals, webhook signatures, idempotency keys | N/A now | Rule     |

## Test with two accounts

| Control              | Phase | Status                    | How / evidence                                                                                      |
| -------------------- | ----- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| Automated two-tenant | P0+   | Done                      | Users A and B in `tests/integration/db/rls.test.ts` and `tests/integration/db/composite-fk.test.ts` |
| Manual two-account   | P0+   | n/a until Phase 1 sign-in | Log in as A, copy an id, try it as B: first run in Phase 1                                          |

## Added in Phase 0 (beyond Appendix A)

| Control                                 | Evidence                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Composite tenant foreign keys           | `tests/integration/db/composite-fk.test.ts`                                                          |
| Tenant keys cannot be updated (cascade) | `tests/integration/db/composite-fk.test.ts` ("restricts key updates on every composite foreign key") |
| `SECURITY DEFINER` functions hardened   | `tests/integration/db/rls.test.ts` ("…pinned search_path and no PUBLIC execute")                     |
| Token contrast (WCAG AA, both themes)   | `tests/unit/design/contrast.test.ts`                                                                 |
| Banned phrases in UI copy               | `tests/unit/content/banned-phrases.test.ts`                                                          |
