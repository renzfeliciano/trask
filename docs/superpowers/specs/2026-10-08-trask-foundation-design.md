# TRASK — Foundation Design (Architecture + Phase 0)

- **Date:** 2026-10-08
- **Status:** Draft — awaiting review
- **Amended:** 2026-10-09 — decisions made while building Phase 0 are in §12 "Amendments (2026-10-09)"; where they differ from the text above, §12 wins.
- **Scope:** Overall architecture, data model, folder structure, design system, security baseline, environments/testing/CI, and the Phase 0 build plan. Phases 1–12 each get their own short spec → plan → build cycle that refines this document.

---

## 1. Intent

### What was stated
- TRASK (TRavis + tASKs) is a visual work-management app: Kanban simplicity, not a Trello clone. Modern, calm, fast, keyboard-friendly, enterprise-ready.
- Two goals: a real productivity tool **and** a portfolio project for learning enterprise-grade full-stack engineering. Every significant feature ships with a "Learning mode" explanation (what / why / trade-offs / security / what to learn / later improvements).
- **Zero cost:** no paid service may be a hard dependency. Paid-by-default capabilities sit behind interfaces with free/local implementations.
- **Multi-tenant** with isolation enforced on the server and in the database, never only in the UI.
- **Security from the ground up**, enterprise-grade, at no cost.
- **Mobile-first** UI: base styles target phones; larger breakpoints enhance.
- Database: **PostgreSQL on Neon**.
- Visual direction: **purple accent** combined with a complementary palette.
- Repo: local folder `trask`, remote `https://github.com/renzfeliciano/trask.git`.

### Decisions made during brainstorming
| Topic | Decision |
|---|---|
| DB environments | Neon `dev` branch for local dev, Neon `main` for prod, Docker Postgres for tests/CI |
| Auth | Better Auth (email + password, DB sessions) |
| Hosting | Vercel Hobby + Neon free tier; Dockerfile kept for self-hosting |
| Spec scope | This foundation spec + Phase 0; later phases get their own specs |
| Server architecture | Approach A: Server Actions → services → scoped repositories → Prisma |
| Package manager | pnpm |

### Assumptions (correct me if wrong)
- Single region deployment is fine for now.
- Free SMTP (e.g. a personal provider's app password or a free-tier relay) is acceptable for production email; development logs emails to the console.
- Git commands are run by the user (the assistant cannot access `.git` on the device); the assistant supplies exact commands.

### Success criteria for the foundation
1. A new developer can clone, configure `.env`, and run lint / typecheck / tests / build / e2e successfully from the README alone.
2. It is structurally difficult to write an unscoped (cross-tenant) query or an unguarded server endpoint — tooling and tests fail if someone tries.
3. Every external capability (storage, email, realtime, AI, logging) runs locally for free.

---

## 2. Architecture

### Style
**Modular monolith** in one Next.js app. No microservices until a demonstrated need.

### Stack
Next.js (App Router) · React · TypeScript (strict, `noUncheckedIndexedAccess`) · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Query · dnd-kit · cmdk · Zod · Prisma + Neon adapter · Better Auth · pino · Vitest · Playwright · @axe-core/playwright · pnpm. Exact versions and the upgrade policy are in **§8 Technology versions & upgrade policy**.

### Request flow
```
Page (RSC read) ──────────────┐
Client UI → Server Action ────┤
                              ▼
        createAction({ schema, permission, handler })
          1. requireAuth()        → AuthContext { userId, sessionId }
          2. Zod .strict() parse  → ValidationError
          3. resolveWorkspace()   → WorkspaceCtx { userId, workspaceId, role }
          4. assertCan(ctx, perm) → AuthorizationError
          5. service(ctx, input)  → business rules + Activity/Audit events
          6. error mapping        → Result<T, SafeError>
                              ▼
        repository(ctx, …)  — every query filtered by ctx.workspaceId
                              ▼
                     Prisma → Neon Postgres
```

### Key mechanisms
- **`createAction` wrapper:** the only way to define a Server Action. Centralizes authentication, validation, workspace resolution, permission check, error mapping, and logging. A test asserts every exported action is wrapped.
- **Scoped repositories:** repository functions accept a `WorkspaceCtx`, never a bare id. Only `server/*/repository.ts` may import the Prisma client (lint-enforced).
- **Centralized authorization:** `ROLE_PERMISSIONS` maps `OWNER | ADMIN | MEMBER | VIEWER` to permissions (`workspace.read/update/delete`, `board.*`, `task.*`, `member.invite/remove`). `can()` / `assertCan()` are the only role checks in the codebase. Resource-specific rules live in `server/<domain>/policy.ts`.
- **Error model:** `AppError` subclasses — `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalError`. Clients receive `{ code, message }` only; internal details (incl. Prisma errors) are logged, never returned.
- **Reads vs. writes:** RSC for page data. Interactive board state uses TanStack Query over Server Actions for optimistic updates, rollback, and stale-response handling (detailed in Phase 6 spec).
- **Ordering:** fractional string rank keys (lexorank-style) for boards, columns, tasks, checklist items — a move updates one row.
- **Concurrency:** `Task.version` for optimistic concurrency; a stale write returns `ConflictError`.

### Ports & adapters (free/local first)
| Port | Phase 0/1 implementation | Future |
|---|---|---|
| `Logger` | pino (JSON, redaction) | any log sink |
| `EmailProvider` | Console (dev), SMTP (prod) | other providers |
| `StorageProvider` | Local disk | S3-compatible |
| `RateLimiter` | Postgres-backed | Redis |
| `RealtimeProvider` | interface only (no-op) | Polling → SSE/WebSocket |
| `AIProvider` | interface only | Local model, hosted APIs |
| `AuditLogger` | Postgres (`AuditEvent`) | external SIEM |
| `Metrics`, `ErrorReporter` | interface + console | external systems |

Interfaces not needed until a later phase are defined but not implemented (YAGNI).

---

## 3. Data model

Conventions: UUIDv7 ids, `createdAt`/`updatedAt` on all tables, Postgres enums for fixed sets, rank strings for ordering.

### Auth (Better Auth-managed)
`User` (email lowercase + unique), `Session`, `Account` (password hash), `Verification`.

### Tenancy
| Model | Fields | Constraints / notes |
|---|---|---|
| Workspace | name, slug, taskSequence, createdById? | slug unique. Future: nullable `organizationId` → `Organization` (additive migration, no rewrite) |
| WorkspaceMember | workspaceId, userId, role | unique(workspaceId, userId); index(userId) |

### Work
| Model | Fields | Notes |
|---|---|---|
| Board | workspaceId, name, description?, position, archivedAt?, createdById? | index(workspaceId, archivedAt). Access derives from workspace role; per-board membership deferred |
| Column | workspaceId, boardId, name, position, kind, wipLimit? | kind = `BACKLOG | TODO | IN_PROGRESS | REVIEW | DONE` |
| Task | workspaceId, boardId, columnId, number, title, description?, priority, position, assigneeId?, dueAt?, startAt?, completedAt?, estimate?, parentTaskId?, archivedAt?, createdById?, version | unique(workspaceId, number); index(columnId, position), (workspaceId, assigneeId), (workspaceId, dueAt). priority = `NONE | LOW | MEDIUM | HIGH | URGENT` |
| Label | workspaceId, name, color | unique(workspaceId, name); workspace-wide |
| TaskLabel | workspaceId, taskId, labelId | PK(taskId, labelId) |
| ChecklistItem | workspaceId, taskId, content, isDone, position | one checklist per task (multiple named checklists deferred) |
| Comment | workspaceId, taskId, authorId?, body, editedAt?, deletedAt? | soft delete keeps thread context |
| Attachment | workspaceId, taskId, uploaderId?, storageKey, fileName, mimeType, sizeBytes, sha256 | storageKey server-generated |

### Audit
| Model | Fields | Notes |
|---|---|---|
| Activity | workspaceId, boardId?, taskId?, actorId?, type, entityType, entityId, metadata (JSON), createdAt | append-only; metadata validated per `type` by Zod; index(workspaceId, createdAt), (taskId, createdAt) |
| AuditEvent | workspaceId?, actorId?, action, entityType?, entityId?, ip?, userAgentHash?, metadata (JSON), createdAt | security trail (auth events, role changes, deletes); separate retention/access from Activity |

### Integrity rules
- **Every tenant-owned table carries `workspaceId`.**
- **Composite foreign keys** tie children to the same workspace as their parent, e.g. `Task(columnId, workspaceId) → Column(id, workspaceId)`, backed by `@@unique([id, workspaceId])` on parents. The database rejects cross-tenant links even if application code is wrong.
- Deleting a workspace cascades to all children. Deleting a user sets assignee/author/actor references to null ("Deleted user").
- JSON only for event metadata whose shape varies by type.
- RLS is enabled on every tenant table from the first migration (see §6 "RLS design").

---

## 4. Folder structure

```
trask/
├── src/
│   ├── app/                      # routes only — thin pages/layouts
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   ├── (app)/w/[workspaceSlug]/b/[boardId]/
│   │   └── api/                  # auth handler, health
│   ├── features/<feature>/
│   │   ├── components/           # React only
│   │   ├── actions/              # Server Actions (createAction)
│   │   ├── schemas/              # Zod (shared client/server)
│   │   ├── hooks/                # TanStack Query + optimistic logic
│   │   └── types.ts
│   ├── server/                   # 'server-only'
│   │   ├── auth/  authz/  errors/  activity/  audit/
│   │   ├── workspaces/ boards/ tasks/ …  (service.ts, repository.ts, policy.ts)
│   │   ├── ports/                # interfaces
│   │   └── adapters/             # local implementations
│   ├── components/ui/            # design-system primitives
│   ├── lib/                      # pure utils (rank, dates, cn)
│   ├── db/                       # Prisma client singleton
│   └── config/                   # env.ts (Zod), constants
├── prisma/  (schema.prisma, migrations/, seed.ts)
├── tests/   (unit/, integration/, e2e/, fixtures/)
├── docs/    (architecture.md, decisions/, security/, superpowers/specs/)
├── docker-compose.yml            # test Postgres
├── Dockerfile
├── renovate.json
└── .github/workflows/ (ci.yml; later backup.yml, restore-test.yml, synthetic-check.yml)
```

### Enforced rules
- `server/**` imports `server-only` → build fails if bundled into client code.
- ESLint import boundaries: `components/ui` ↛ `features`; `features` ↛ `db`/repositories; only repositories import `db`.
- `config/env.ts` validates all env vars at boot; invalid config = app refuses to start.
- Small, single-purpose files: one action per file, one service per domain.
- ADRs in `docs/decisions/` for every major decision.

---

## 5. Design system & mobile-first UX

### Tokens (from the brand board; light + dark)
Contrast ratios below were computed (WCAG 2.1) and are enforced by the token contrast test.

| Token | Light | Dark | Use / rule |
|---|---|---|---|
| `--primary` | `#7C3AED` | `#7C3AED` | Primary buttons, selection. White text on it = 5.7:1 ✓ |
| `--primary-hover` | `#6D28D9` | `#6D28D9` | Primary button hover. A solid shade, not opacity, so white text keeps ≥ 4.5:1 |
| `--primary-text` | `#7C3AED` (5.4:1 on bg) | `#A78BFA` (7.0:1 on bg) | Links, active nav, primary-colored text |
| `--secondary` | `#A78BFA` | `#A78BFA` | **Fills only** (progress, chips). Never text on white (2.7:1 ✗); dark text on it is fine (5.9:1) |
| `--secondary-foreground` | `#1E1B4B` | `#1E1B4B` | Text on `--secondary` fills, both themes |
| `--accent` | `#C4B5FD` | `#2E2650` | Hover/selected backgrounds, drop targets |
| `--background` | `#F8F7FF` | `#0F0D1F` | App background |
| `--surface` | `#FFFFFF` | `#1A1730` | Cards, sheets, columns |
| `--foreground` | `#1E1B4B` (15:1) | `#EDE9FE` (16:1) | Body text |
| `--muted-foreground` | `#6B7280` (4.5:1) | `#9CA3AF` (7.5:1) | Secondary text; never smaller than 13 px |
| `--ring` | `#7C3AED` | `#A78BFA` | Focus outline (2 px + 2 px offset) |
| `--input` | `#8E89B5` | `#6A6592` | Form-control borders: ≥ 3:1 against surface and background (WCAG 1.4.11); `--border` is decorative only |
| `--highlight` | `#FACC15` (dark text 10.4:1) | same | Due-soon, Focus Mode marker — the warm complement to violet |
| `--highlight-foreground` | `#1E1B4B` | `#1E1B4B` | Text on `--highlight`, both themes |
| `--success` / `--danger` / `--info` | `#16A34A` / `#DC2626` / `#2563EB` | `#4ADE80` / `#F87171` / `#60A5FA` | Danger button white text 4.8:1 ✓ (light). Dark danger carries dark text (`--danger-foreground` `#0F0D1F`) |
| `--danger-hover` | `#B91C1C` | `#FCA5A5` | Danger button hover; lightens in dark mode because dark danger carries dark text |
| `--warning` | `#EA580C` | `#FB923C` | Icons and borders only (orange, distinct from `--highlight`); never a text background |
| Labels (10) | pink `#F472B6`, coral `#F87171`, green `#4ADE80`, yellow `#FACC15`, blue `#60A5FA` + 5 matched tints | same hues, adjusted | Label chips use dark text |
| `--label-foreground` | `#1E1B4B` | `#1E1B4B` | Text on every label chip, both themes |

- **Brand gradient** `#7C3AED → #A78BFA` is reserved for the app icon and the landing-page hero. Never on buttons, cards, headers or other product UI.
- Neutrals are slightly violet-tinted; the board stays mostly white/near-white so task content leads.
- All text/background pairs meet WCAG AA in both themes (verified by a token contrast test).
- Typography: Geist Sans / Geist Mono. Spacing scale, 3 radii, 3 shadow levels, motion tokens that collapse to 0 under `prefers-reduced-motion`.
- No heavy gradients or glassmorphism.

### Primitives
Button, Input, Select, Dropdown, Dialog, Sheet, Tooltip, Badge, Avatar, Card, Command, Toast, Tabs, EmptyState, Skeleton, ErrorState.

### Responsive behavior (mobile-first)
| | Phone (base) | Tablet (`md`) | Desktop (`lg`+) |
|---|---|---|---|
| Navigation | Bottom bar + central Quick Capture | Collapsible sidebar | Sidebar + ⌘K palette |
| Board | Column switcher (tab strip with counts), one column at a time, swipe (scroll-snap) | 2–3 columns, snap scroll | Full horizontal board |
| Task detail | Full-height bottom sheet | Bottom sheet | Right drawer |
| Moving tasks | "Move to…" action sheet (primary); long-press reorder | Drag + menu | Drag, menu, keyboard |

- Task detail is URL-addressable (`?task=TRK-42`): deep links and back button work everywhere.
- Touch targets ≥ 44px; safe-area insets respected.
- Focus Mode collapses other columns into rails, marked with the yellow `--highlight`.
- Theme: system default + manual toggle.
- Drag-and-drop is never the only way to move a task.

### Brand & mascot
The reference board (logo, mascot states, tagline) defines TRASK's personality. The user is recreating the final artwork; the system below is built so that artwork drops in without code changes.

**Role of the mascot.** The UI stays calm and flat; the mascot is the **single expressive element** and appears only at moments where the user needs reassurance or direction: when there's nothing on screen, when something finishes, or when something fails. It never decorates working views.

| State key | Where it appears | Title / line (exact copy) |
|---|---|---|
| `welcome` | First sign-in, empty workspace list | "Welcome to TRASK." / "Create a board and start moving work." |
| `empty` | Empty board, empty column (small) | "Nothing here yet." / "Add a task to get this board moving." |
| `creating` | Quick Capture sheet header (small, once per session) | — (no text; decorative) |
| `done` | A column or board is cleared to Done | "Clean board. Nice work." |
| `searching` | Command palette / search while loading | "Looking…" |
| `no-results` | Search with no matches | "Nothing found." / "Try a different search." |
| `focus` | Entering Focus Mode (toast-sized) | "One thing at a time." |
| `error` | Error boundary, failed load, 404 | "Well… that wasn't supposed to happen." / plus a concrete recovery action |

**Rules**
- At most **one mascot per screen**; never inside board columns' card lists, the task drawer, tables, forms, or menus.
- Sizes: 160 px (empty/error, `lg`), 120 px (phone), 40 px (toast/inline). Mobile-first: the phone size is the default.
- **Decorative only:** `alt=""` + `aria-hidden`; the text always carries the meaning. Never communicate state only through the mascot's expression.
- **Reduced motion:** static art only; no bouncing, confetti, or entrance animations. The `done` celebration plays a single 200 ms fade, disabled under `prefers-reduced-motion`.
- **User control:** Settings → "Show mascot" (on by default). Teams that want a strictly neutral UI can turn it off; text and layout stay intact.
- **Dark mode:** a dedicated dark variant per state (lighter outline, no white halo), chosen automatically by theme.
- Sparkles/confetti are allowed **only inside the mascot artwork itself**, never as standalone UI icons.

**Assets & pipeline**
- Logo mark, app icon, favicon and wordmark: **SVG** built in code (`currentColor`/tokens), so the brand color is one token change. Generates `icon.svg`, `apple-icon.png` (180), PWA icons (192/512, maskable) and `manifest.webmanifest` (installable on phones).
- Mascot states: transparent **WebP** (with AVIF via `next/image`) exported at 3× the largest display size; budget ≤ 30 KB per file; lazy-loaded except on the welcome screen.
- A typed manifest maps `MascotState` → light/dark files. Until final art exists, `<Mascot>` falls back to the logo mark, so no screen breaks while artwork is in progress.
- Tagline: **"Work moves here."** (used on the landing page and auth screens). "Free. Simple. Powerful." is not used in product UI.

**Brand color:** violet `#7C3AED`, confirmed by the recreated purple brand board (tokens above).

**Artwork rules:** no text baked into illustrations (copy lives in code, so it can be fixed and translated — the board's "Tunig ideas into progress" typo shows why). Interim state art has been cut from the brand board with backgrounds removed (`public/brand/mascot/*.webp`, 6–14 KB each); final exports replace them file-for-file.

### Quality bar: no "AI slop"
TRASK must look and read like a product designed by people who use it daily, not a generated template. These rules are checked in every phase review.

**Visual**
- Violet is an accent, not a theme: **no purple-to-blue gradients**, no glowing blobs, no glassmorphism, no gradient text. Surfaces stay neutral; color carries meaning (state, priority, selection).
- No decorative sparkle/✨ icons, no emoji in UI chrome, no stock illustrations — the TRASK mascot is the only illustration system, used per "Brand & mascot" rules. One consistent icon set (Lucide), used only where an icon aids recognition.
- No "everything is a rounded-2xl card with a shadow". Use the 3 radius tokens and borders; shadows only for elevation (menus, sheets, dragged card).
- Density is deliberate: cards show title, priority, due date, labels, assignee — nothing else. No filler stats, fake charts, or "dashboard" tiles without real data.
- Typography sets hierarchy (size/weight/color), not boxes and badges everywhere.
- Motion only to explain change: card movement, sheet open/close, drop target. No entrance animations on page load.
- Every screen is reviewed as a screenshot at phone and desktop widths, in light and dark, before a phase is done.

**Copy**
- Plain, specific, product voice. No "Unlock your productivity", "Seamlessly", "Supercharge", "Elevate", "Effortlessly", "Dive in", "🚀".
- Buttons say what happens: "Create task", "Move to Review", not "Submit"/"Get started".
- Empty and error states say what happened and what to do next, in one or two short sentences.
- Seed data reads like real work (specific tasks with realistic titles, owners, dates), never "Task 1", "Lorem ipsum", or "Example project".
- A banned-phrase list lives in `docs/content-style.md` and is checked by a test over UI strings.

**Code**
- No speculative abstractions: an interface exists only if there are two implementations or a test double that needs it (ports listed in §2 are the exceptions, each justified in an ADR).
- Comments explain *why*, never restate the code. No commented-out code, no `TODO` without an issue reference.
- Names come from the domain (task, column, workspace, rank), consistent everywhere — no `data`, `info`, `handleStuff`, `utils2`.
- No dead code, unused exports, or unused dependencies (`knip` in CI).
- Every file has one clear job; components over ~200 lines or functions over ~50 lines get split or justified.
- Each phase ends with a human-readable code review pass (by me, then you), not just green checks.

**Docs**
- README and ADRs are short and specific to TRASK: what was decided, why, and what was rejected. No generic textbook filler.

---

## 6. Security baseline (all free)

### Authentication
- Better Auth email/password; scrypt hashing; password length 12–128; breached-password check via HIBP k-anonymity.
- DB sessions; cookies `httpOnly`, `Secure`, `SameSite=Lax`; 7-day rolling expiry; revoke all sessions on password change; "sign out everywhere".
- Generic login/reset responses (no account enumeration).
- Rate limiting on auth endpoints (Postgres-backed, behind `RateLimiter`).
- Email verification and password reset through `EmailProvider`.

### Authorization & tenant isolation
- Defense in depth, four layers: scoped repositories + `assertCan()` + composite foreign keys + **Postgres Row-Level Security from Phase 0** (see "RLS design" below).
- Cross-tenant access returns `NotFound` (no existence leak).
- Cannot grant a role above one's own; cannot remove the last OWNER.
- `workspaceId`, `role`, `actorId` always come from server context, never from client input.

### Input & output
- Zod `.strict()` on all inputs; explicit field mapping into Prisma (no spreading input → no mass assignment).
- Markdown rendered with raw HTML disabled + sanitizer; `dangerouslySetInnerHTML` banned by lint.
- Prisma parameterized queries; `$queryRawUnsafe`/`$executeRawUnsafe` banned by lint.

### Web hardening
- Nonce-based CSP, HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`.
- CSRF: Server Actions origin check, Better Auth `trustedOrigins`, SameSite cookies.
- Uploads (Phase 5+): size cap, MIME allowlist + magic-byte sniffing, server-generated keys, served only via an authorized route with `Content-Disposition: attachment`.

### Operations & supply chain
- Separate Neon roles: `trask_app` (DML only) and `trask_migrator` (DDL). TLS required.
- Secrets only in env; `.env*` git-ignored; Zod-validated at boot.
- CI: gitleaks, `pnpm audit`, Semgrep OSS; CodeQL if the repo is public. `SECURITY.md` disclosure policy.
- Dependency supply chain: exact-pinned versions + committed lockfile; pnpm `minimumReleaseAge` (new releases must age ≥ 3 days before install, blocking freshly-compromised packages); Renovate opens update PRs that must pass full CI (see §8).
- pino logs redact passwords, tokens, cookies, auth headers; no PII beyond user id.
- `AuditEvent` for every security-relevant action.
- STRIDE threat model in `docs/security/threat-model.md`, updated each phase.

### RLS design (Phase 0)
- Every tenant table: `ENABLE` + `FORCE ROW LEVEL SECURITY`. The app connects as `trask_app`, which is not the table owner and has no `BYPASSRLS`.
- Repositories run inside a Prisma extension `withTenant(ctx)` that executes `set_config('app.user_id', <id>, true)` in the same transaction as the query (transaction-local, safe with Neon's pooled connections).
- Policies call a `SECURITY DEFINER` function `app.is_member(workspace_id)` (fixed `search_path`) that checks `WorkspaceMember` for the current `app.user_id`. The database verifies membership itself; it does not trust a workspace id passed by the app.
- If `app.user_id` is not set, policies see no rows (**fail closed**).
- Workspace creation uses a dedicated `SECURITY DEFINER` function that inserts the workspace and its OWNER membership atomically.
- Better Auth tables are outside RLS and are only accessed through a separate auth client inside `server/auth`.
- Integration tests run as `trask_app` and prove that a query with User B's context returns no rows of User A's workspace, even when it bypasses the repository layer.

### Additional controls adopted from the pre-launch checklist
- **Default deny:** `createAction` requires an explicit `permission` (or an explicit `public: true`); middleware protects every route except an explicit public allowlist.
- **Role ranking:** `ROLE_RANK = { VIEWER: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 }` with `atLeast(role, min)`. No `role === "x"` comparisons (lint rule).
- **Role re-checked per request** from the database. Revoking membership takes effect on the next request.
- **Email verification enforced in `requireAuth()`** (where sessions are validated), not only at sign-in.
- **No enumeration on sign-up either:** sign-up always answers "check your email"; an existing address receives a "someone tried to register" email instead.
- **MFA:** TOTP + backup codes via Better Auth `twoFactor` plugin (Phase 1). TOTP secrets encrypted at rest by the library.
- **Self-service account deletion** with re-authentication; sole-owned workspaces must be transferred or deleted first (Phase 1/10).
- **Timing-safe comparison:** any token we issue ourselves (e.g. invitations) is stored hashed and compared with `crypto.timingSafeEqual`.
- **Abuse:** rate limits per IP **and** per user on sign-in, sign-up, password reset, email-sending actions and uploads (counters persisted in Postgres); honeypot field on sign-up and forgot-password; disposable-email blocking at sign-up (with an allowlist override for false positives); failed-login spikes raise a `security.alert` event and notify the account owner by email.
- **Idempotency:** create actions (e.g. Quick Capture) accept a client-generated `idempotencyKey` with a unique constraint, so a double submit creates one task.
- **Body size limits:** Server Actions `bodySizeLimit` set explicitly; uploads check `Content-Length` and stream with a hard cap before buffering.
- **No shell execution:** `child_process` banned by lint; if ever needed, arguments passed as arrays only.
- **Open redirects:** post-login `next` parameter accepted only as a same-site relative path (`/…`, not `//…`); otherwise go to the dashboard.
- **SSRF rule (for future link previews/webhooks):** host allowlist, block private/link-local ranges incl. `169.254.169.254`, re-check on every redirect. No server-side fetching of user URLs exists yet.
- **HTML:** no raw HTML rendering; if ever required, sanitized with DOMPurify only.
- **Cache-Control:** authenticated pages and action responses `private, no-store`; only hashed static assets are publicly cacheable.
- **HSTS** `max-age=63072000; includeSubDomains` — no `preload` until a custom domain is settled (preload is hard to undo).
- **No stack traces / debug surfaces in production:** generic error pages; `/dev/ui` returns 404 in production; `/api/health` returns `{ status }` only; Prisma Studio local only.
- **Static & secret exposure tests:** E2E asserts `/.env`, `/.git/config`, `/*.zip`, `/*.map` return 404; production browser sourcemaps off; CI scans the built client bundle for secret values and non-allowlisted `NEXT_PUBLIC_` variables.
- **Uploads (Phase 5):** magic-byte check **plus** size cap, MIME allowlist, image re-encoding (sharp), never served with an executable or HTML type, per-file and lifetime per-workspace storage quotas.
- **Seed safety:** seed script refuses to run when `NODE_ENV=production`; demo account only in dev/preview with a random password printed once.
- **Encryption helper:** AES-256-GCM via Node `crypto` (key from env) for any future third-party tokens; no custom crypto.
- **Backups (Phase 12):** Neon point-in-time restore plus a nightly GitHub Actions `pg_dump`, encrypted and kept as a private artifact with retention; a monthly workflow restores the latest backup into Docker Postgres and runs sanity checks.
- **Alerting (Phase 12):** scheduled GitHub Actions health/synthetic check that opens an issue and emails on failure; `ErrorReporter` port allows an optional free-tier service later.
- **Security contact:** `SECURITY.md` + `/.well-known/security.txt`. Leaked-secret rotation runbook in `docs/security/`.
- **Legal pages (Phase 12):** Terms, Privacy Policy, sub-processor list (Vercel, Neon, GitHub, SMTP provider), cookie disclosure (session cookie only, so no consent banner), data export (JSON) and deletion, each document dated separately. Templates only; not legal advice.

### Per-phase security definition of done
Authorization + tenant-isolation tests pass (repository **and** RLS level) · all new inputs validated · no unguarded endpoints · logs checked for secrets · dependency audit clean · threat model and controls matrix (Appendix A) updated · manual two-account test done (log in as A, copy an id, try it as B).

---

## 7. Environments, testing & CI

### Environments
| Env | Database | Notes |
|---|---|---|
| Local dev | Neon `dev` branch | `prisma migrate dev`, seed data |
| Tests / CI | Docker Postgres (`docker-compose.yml`, port 5433) | Throwaway, reset per run |
| Production | Neon `main` branch | `prisma migrate deploy` with migrator role; Vercel Hobby |

### Test layers
- **Unit (Vitest):** permission matrix (every role × permission), rank util, Zod schemas, services with in-memory fakes, token contrast, "every action is wrapped". Coverage thresholds on `server/authz` and domain services.
- **Integration (Vitest + Docker Postgres):** repositories and services against a real DB, composite-FK rejection.
- **Tenant-isolation suite:** seeds User A and User B; a registry lists every repository method and the suite fails if any method lacks an isolation case.
- **E2E (Playwright):** critical flows on two projects — mobile (first) and desktop — with axe-core scans per page.

### CI pipeline (GitHub Actions)
```
install (pnpm cache) → lint → typecheck → unit
  → integration (Postgres service container)
  → build → e2e (PRs to main)
  ∥ gitleaks + pnpm audit + Semgrep
```
Branch protection on `main`. Vercel: previews from PRs, production from `main`.

---

## 8. Technology versions & upgrade policy

### Pinned baseline (verified against the npm registry / vendor sites on 2026-10-08; re-verified at scaffold)
| Technology | Version | Note |
|---|---|---|
| Node.js | **24 LTS** (24.21.x) | Active LTS. Node 26 is "Current", not LTS — move once it enters LTS |
| pnpm | 12.10.x | |
| Next.js / eslint-config-next | 16.4.x | |
| React / React DOM | 19.3.x | |
| TypeScript | **6.0.3** | TS 7.0.2 is out, but its native compiler has no programmatic API yet; typescript-eslint supports `<6.1`. Upgrade to 7.x when typescript-eslint supports it (expected with TS 7.1) |
| Tailwind CSS | 4.3.x | |
| Prisma / @prisma/client / @prisma/adapter-neon | **7.10.x** | npm `latest` tag points at 8.0.0-rc (a release candidate); Better Auth supports Prisma ≤ 7. Move to 8 when stable + supported |
| @neondatabase/serverless | 1.2.x | |
| PostgreSQL | 18 | Neon default; Docker test image pinned to the same major |
| Better Auth | 1.7.x | |
| Zod | 4.6.x | |
| TanStack Query | 5.104.x | |
| dnd-kit | @dnd-kit/core 6.3.x + @dnd-kit/sortable 10.x | The newer `@dnd-kit/react` is pre-1.0 (0.5); revisit at 1.0 |
| cmdk | 1.1.x | |
| next-themes | 0.4.x | |
| pino | 10.4.x | |
| ESLint / typescript-eslint | 10.12.x / 8.71.x | |
| Prettier | 3.9.x | |
| Vitest | 5.0.x | |
| Playwright / @axe-core/playwright | 1.63.x / 4.13.x | |
| Husky / lint-staged | 9.1.x / 17.6.x | |
| shadcn CLI | 4.21.x | Components are copied into `components/ui` (owned code, no runtime dependency) |

Rule: **latest stable only** — no RC, beta, canary, or pre-1.0 packages unless no stable alternative exists (recorded in an ADR).

### Making upgrades easy
1. **Single sources of truth:** Node version in `.nvmrc` + `engines`; pnpm in `packageManager`; Postgres major in `docker-compose.yml` and the CI service (one variable); all library versions only in `package.json`.
2. **Exact pins + lockfile:** `save-exact=true`; reproducible installs everywhere (`pnpm install --frozen-lockfile` in CI).
3. **Renovate (free, open-source GitHub app)** instead of Dependabot — it handles pnpm's `minimumReleaseAge` natively and supports grouping:
   - Grouped PRs: `next` + `eslint-config-next`; all `prisma`/`@prisma/*`; `react` + `react-dom` + `@types/react*`; `@dnd-kit/*`; `@playwright/test` + Docker image; ESLint family.
   - Patch/minor dev-dependency PRs auto-merge **only** when the full CI pipeline is green; runtime minors and all majors require manual review.
   - Weekly schedule + a dependency dashboard issue; security updates immediately.
   - Same 3-day minimum release age as pnpm.
4. **Thin wrappers around third parties:** Better Auth only inside `server/auth`, Prisma only inside repositories, Radix only inside `components/ui`, dnd-kit only inside `features/board/dnd`, pino only inside the Logger adapter. A breaking library change touches one folder.
5. **Tests are the upgrade safety net:** unit + integration + tenant-isolation + E2E (mobile & desktop) run on every Renovate PR.
6. **`docs/upgrading.md` runbook:** how to apply a major upgrade (read changelog → run codemods → update ADR → full test pass), plus a watch list: TypeScript 7.x, Prisma 8, `@dnd-kit/react` 1.0, Node 26 LTS.

---

## 9. Phase 0 plan (Foundation)

1. **Neon:** project `trask`; branches `main`, `dev`; roles `trask_app`, `trask_migrator` (via Neon connector or console).
2. **Scaffold:** versions per §8 — Next.js + TS strict, Tailwind v4, pnpm, Node 24 LTS (`.nvmrc`, `engines`, `packageManager`), `.npmrc` with `save-exact` and `minimumReleaseAge`.
3. **Guardrails:** ESLint (boundaries, `eslint-plugin-security`, bans on `dangerouslySetInnerHTML`, raw-unsafe SQL, `child_process`, direct role equality), Prettier, Husky + lint-staged; CI step scanning the client bundle for secrets.
4. **Config:** `config/env.ts` (Zod), `.env.example`, `server-only`.
5. **Web hardening:** middleware with nonce CSP + security headers + `Cache-Control` rules + default-deny route protection; `/api/health` (status only); `/.well-known/security.txt`; Server Action body size limit; E2E checks that dotfiles/backups/sourcemaps 404 and no CORS headers are sent.
6. **Server core:** AppError hierarchy, `Result`, pino logger with redaction, `createAction` (default deny, idempotency support), `ROLE_RANK` + `ROLE_PERMISSIONS` + `can`/`assertCan`/`atLeast`, safe-redirect helper, AES-GCM encryption helper, rank util — all unit-tested.
7. **Database:** Prisma + Neon adapter; full schema incl. Better Auth tables and composite FKs; first migration with RLS policies, `app.is_member()`, and the `trask_app` grants; `withTenant(ctx)` extension; integration tests proving cross-workspace links are rejected **and** RLS hides other workspaces' rows; seed scaffold with production guard.
8. **Test harness:** Docker test Postgres; Vitest (unit + integration); Playwright (mobile + desktop) smoke test verifying headers and axe.
9. **Design system foundation:** brand-board tokens (violet `#7C3AED`, light/dark), Geist, theme toggle, core primitives, dev-only `/dev/ui` showcase.
10. **CI & supply chain:** workflow above, gitleaks, `pnpm audit`, Semgrep, Renovate config (`renovate.json`), `SECURITY.md`.
11. **Docs:** README, `docs/architecture.md`, ADRs (Neon, Better Auth, approach A, composite FKs, mobile-first, ports & adapters, version & upgrade policy), `docs/security/threat-model.md`, `docs/upgrading.md`.

Phase 0 also adds `knip` (unused code/deps) to CI and `docs/content-style.md` with the banned-phrase test.

### Phase 0 exit criteria
`pnpm lint`, `typecheck`, `test`, `test:integration`, `build`, `e2e` pass locally and in CI · app refuses to boot with invalid env · security headers verified by test · threat model reviewed · Learning-mode write-up delivered.

---

## 10. Roadmap (each phase gets its own spec)

1. Authentication · 2. Workspace · 3. Boards · 4. Workflow (columns) · 5. Tasks · 6. Drag & drop + optimistic UI · 7. Activity · 8. UX (command palette, quick capture, shortcuts, focus mode, mobile polish, dark mode, a11y) · 9. Search (Postgres full-text) · 10. Collaboration (members, roles, invitations) · 11. Hardening (security review, RLS, performance, a11y audit) · 12. Production readiness (observability, health, deployment docs).

## 11. Explicitly deferred
Organizations, per-board membership, multiple checklists per task, realtime transport, AI features, list/timeline/calendar views, Redis, external search engines, paid monitoring.

---

## 12. Amendments (2026-10-09)

Decisions made while planning and building Phase 0. Where they differ from §1–§11, this section wins.
"R" numbers match the rulings referenced in code comments. Rationale lives in the ADRs (`docs/decisions/`).

### From the Phase 0 plan

1. **`@prisma/adapter-pg` instead of `@prisma/adapter-neon`** (§2 Stack, §8, §9.7). One driver
   (node-postgres over TCP) for Docker tests and Neon's pooled endpoint, so tests exercise the production
   driver. `@neondatabase/serverless` is not used. `pg` is a direct exact dependency. ADR 0002.
2. **RLS is `ENABLE`d, not `FORCE`d** (§6 "RLS design", first bullet). `trask_app` is not the table owner,
   so RLS always applies to it; `FORCE` would also bind the owner and make the `SECURITY DEFINER`
   membership function recurse into its own policy. ADR 0004.
3. **Better Auth `Session`/`Account`/`Verification` tables arrive in Phase 1** (§3 Auth, §9.7) via the
   Better Auth CLI as an additive migration. Phase 0 creates only `User` with Better Auth's core fields.
4. **`src/proxy.ts`**, Next.js 16's replacement for `middleware.ts` (§4, §6, §9.5: read "middleware" as
   "proxy").
5. **`Activity` and `AuditEvent` are append-only by grants:** `trask_app` has `SELECT, INSERT` on
   `Activity` and `INSERT` only on `AuditEvent`.
6. **Idempotency lives on the entity, not in `createAction`** (§6 "Idempotency", §9.6). A create action
   that needs it adds a nullable `idempotencyKey` with `@@unique([workspaceId, idempotencyKey])` (first
   use: task creation, Phase 5); the service returns the existing record on that unique violation.

### Rulings made during the build

- **R14 — "latest stable" means the latest stable release that passes the 3-day release-age gate**
  (§6 supply chain + §8 together). Next.js and eslint-config-next are pinned at **16.3.8** (16.4.0 was
  2 days old); Renovate moves them. R15 keeps a `@eslint/compat` shim until eslint-config-next 16.4+.
- **R37 — the 3-day `minimumReleaseAge` stays** (pnpm and Renovate). CI excludes exactly the two Semgrep
  registry rules that demand 7 days.
- **R5 — `AuditEvent` is outside RLS.** Its protection is the insert-only grant; it has no tenant read
  path. It is written with `createMany` (no `RETURNING`). It is not tamper-evident.
- **R20 — `Task → Column` FK is `(columnId, boardId, workspaceId) → Column(id, boardId, workspaceId)`**
  (§3 "Integrity rules"), so a task's column is always on the task's own board.
- **R23 — every composite tenant FK is `ON UPDATE RESTRICT`.** Cascaded key updates bypass RLS and
  could move a subtree into another workspace. Moving a board between workspaces needs explicit logic.
- **R21 — the Prisma client is created lazily (`getDb()`),** and R3 does the same for the logger
  (`getLogger()`): importing a module never requires env, so unit tests and `next build` need no secrets.
  §4 "invalid config = app refuses to start" is kept by `src/instrumentation.ts`: when the Node server
  starts it validates the environment and exits with code 1, printing the failing variable names and
  never their values. `next build` and the edge runtime skip the check.
- **R25 — scripts run by `tsx` use `tsconfig.scripts.json`,** which maps `server-only` to the test stub
  (the npm package is pre-1.0 and not installed).
- **R26 — the seed guard allows only `development` and `test`;** an unset `NODE_ENV` is refused.
- **R27 — `createAction` is one generic function over a discriminated config** (exactly one of
  `permission`, `authenticated: true`, `public: true`; checked at definition time), each action has a
  required `name`, unverified-email sessions count as anonymous in `public` actions, top-level unknown
  keys are rejected and nested unknown keys are stripped.
- **R30 — in `NODE_ENV=development` only, `/_next/*` and `/__nextjs*` are public** so dev tooling works
  without a session. Production keeps the exact allowlist.
- **R31 — token table refined for dark mode and form controls** (§5): `--primary-hover`,
  `--danger-hover`, `--highlight-foreground`, `--secondary-foreground`, `--label-foreground`, `--input`
  and `--warning` added (table above updated).
- **R32 — the wordmark is Geist text,** not SVG paths, until a designer supplies vector art. The logo
  mark stays SVG.
- **R33 — no `class-variance-authority`** (pre-1.0); components use typed class maps. shadcn 4.21.x
  rewrites the `@/lib/cn` alias on `add`; `docs/upgrading.md` has the check.
- **R35 — the proxy answers 404 for `/dev/ui` in production before the session check;** E2E runs the
  server with `NODE_ENV=production`; WebKit runs in CI only.
- **R36 — the CI bundle-scan guard requires `DATABASE_URL`, `MIGRATION_DATABASE_URL` and
  `ENCRYPTION_KEY`** to be set, rather than "any value" (pnpm injects its own variables).

### Other Phase 0 facts that refine this spec

- Local development may use the Neon `dev` branch, but **migrations are authored against the Docker
  database** (`prisma migrate dev` needs a shadow database; only the local migrator has `CREATEDB`).
  Neon receives migrations only via `prisma migrate deploy` (§7 Environments).
- **Postgres 18 is required** (`uuidv7()` in the migrations). On Neon, `trask_app` and `trask_migrator`
  are created by SQL before the first deploy, and `trask_migrator` gets `CREATE` on the database and on
  schema `public`.
- **RLS separates workspaces, not roles.** Any member can write at the database level; `assertCan` is the
  role barrier. Ids are server-generated (unique checks run before RLS). The `User` table is outside RLS
  until Phase 1 decides.
- Libraries for later phases (Better Auth, TanStack Query, dnd-kit, cmdk) are not installed yet; knip
  rejects unused dependencies. `@types/node` is pinned to the 24 line.
- Spec §8 versions that differ: `@playwright/test` 1.63.0, `radix-ui` 1.6.7 (single package). shadcn
  components are copied in; the CLI is run with `pnpm dlx`.

---

## Appendix A — Pre-launch security controls matrix

Status: **P0–P12** = phase where it is built and tested · **Rule** = written policy enforced in review/lint, nothing to build yet · **N/A** = does not apply (reason given). This matrix is kept in `docs/security/controls.md` and updated every phase.

### Access control
| Control | Status | How |
|---|---|---|
| CORS, never `*` | P0 | No CORS headers at all (same-origin app); E2E asserts absence; explicit allowlist if a public API is ever added |
| SameSite cookies (CSRF) | P1 | `SameSite=Lax` + Server Action origin check + Better Auth `trustedOrigins` |
| Row-Level Security | **P0** | §6 RLS design (moved up from Phase 11) |
| Scoped queries | P0 | `workspaceId` inside every query via scoped repositories; RLS underneath |
| Server-side gates | P0 | `createAction` + `assertCan` on every action; UI hiding is cosmetic only |
| Static files ignore auth | P0/P5 | `public/` holds only non-sensitive assets; attachments live outside it, served via an authorized route |
| 404 instead of 403 | P0 | Cross-tenant lookups return NotFound; applies to sequential task numbers (`TRK-42`) too |

### Roles & permissions
| Control | Status | How |
|---|---|---|
| Server-side RBAC | P0 | `ROLE_PERMISSIONS` + `assertCan` |
| Never read role from client | P0 | Role resolved from `WorkspaceMember` in the DB each request |
| Block mass assignment | P0 | Zod `.strict()` + explicit field mapping |
| Rank roles, don't compare | P0 | `ROLE_RANK` + `atLeast()`; lint bans role equality checks |
| Default deny | P0 | Actions need explicit permission; middleware public allowlist |
| Re-check role per request | P0 | No role in session/token; DB lookup per request |
| Least privilege for staff | Rule | No platform-staff role exists; if added, scoped permissions and no bulk user-data access |
| Separate role from plan | Rule | No plans yet; future `plan` is a separate field and separate check |
| Log privileged actions | P1/P10 | `AuditEvent` for role grants/removals, deletes, security settings |

### Accounts
| Control | Status | How |
|---|---|---|
| Password hashing | P1 | scrypt (Better Auth) |
| Minimum length + breached list | P1 | 12–128 chars + HIBP k-anonymity |
| httpOnly cookies | P1 | Session cookie only; nothing auth-related in localStorage |
| Session expiry + fresh session at login | P1 | 7-day rolling; new session issued at sign-in |
| Email verification at session validation | P1 | Enforced in `requireAuth()` |
| No account enumeration | P1 | Identical responses for sign-in, sign-up, forgot-password |
| Kill sessions on password reset | P1 | All devices revoked |
| Timing-safe comparison | P1 | Library internals + `crypto.timingSafeEqual` for our own tokens |
| MFA option | P1 | TOTP + backup codes |
| Self-service account deletion | P1/P10 | Re-auth required; workspace ownership handled first |

### Abuse & cost
| Control | Status | How |
|---|---|---|
| Rate limiting per IP and per user | P1 (+P5 uploads) | Postgres-backed `RateLimiter` |
| Persisted counters | P1 | Stored in Postgres, survive deploys and multiple instances |
| Brute-force alerts | P1 | `security.alert` event + email to account owner |
| Spend caps | N/A now | No paid APIs. Mandatory per-user + global daily caps before any AI/paid API is added |
| Storage caps (lifetime) | P5 | Per-file cap + lifetime per-workspace quota |
| Honeypot field | P1 | Sign-up and forgot-password forms |
| Disposable email blocking | P1 | Free domain list at sign-up, allowlist override |

### Input & files
| Control | Status | How |
|---|---|---|
| Server-side validation | P0 | Zod on every action |
| Parameterized queries | P0 | Prisma; raw-unsafe SQL banned |
| Command injection | P0 | `child_process` banned; array args only if ever needed |
| Magic-byte checks | P5 | Signature sniffing on upload |
| Beyond magic bytes | P5 | Size cap, re-encode images, never executable/HTML content types, `Content-Disposition: attachment` |
| Check limits before reading | P0/P5 | Body size limits; `Content-Length` + streaming cap |
| No paths from user input | P5 | Server-generated `storageKey`, lookup by id |
| Sanitize HTML (DOMPurify) | P5 | No raw HTML; markdown without HTML; DOMPurify if HTML ever needed |
| No open redirects | P1 | Relative-path-only `next` parameter |
| SSRF protection | Rule | No user-URL fetching yet; allowlist/private-IP/redirect rules when added |

### AI features
| Control | Status | How |
|---|---|---|
| Prompt injection, limited tools, no other users' data, untrusted output | Rule (deferred) | Written into the `AIProvider` contract and ADR; enforced when AI ships |

### Browser & headers
| Control | Status | How |
|---|---|---|
| HTTPS everywhere | P0/P12 | Vercel TLS; no mixed content |
| CSP with nonces | P0 | Middleware nonce CSP |
| HSTS | P0 | No preload until custom domain |
| frame-ancestors none | P0 | CSP |
| nosniff | P0 | Header |
| Cache-Control | P0 | `private, no-store` behind login |
| No stack traces in prod | P0 | Generic error pages; safe error mapping |
| Remove X-Powered-By | P0 | `poweredByHeader: false` |

### Secrets
| Control | Status | How |
|---|---|---|
| Env vars only + history check | P0 | Zod env; gitleaks scans full git history in CI |
| No secrets in frontend | P0 | CI scans client bundle; `NEXT_PUBLIC_` allowlist |
| Block dotfiles/backups | P0 | E2E asserts 404s |
| Sourcemaps off in prod | P0 | Browser sourcemaps disabled; E2E asserts `.map` 404 |
| Least-privilege DB user | P0 | `trask_app` vs `trask_migrator` |
| Encrypt third-party tokens | P0 helper / Rule | AES-256-GCM helper ready; no third-party tokens stored yet |
| No custom crypto | Rule | Node `crypto` and library primitives only |
| Rotate leaked secrets | P0 | Runbook in `docs/security/` |

### Infrastructure
| Control | Status | How |
|---|---|---|
| No test/default accounts | P0 | Seed blocked in production |
| No public debug endpoints | P0 | `/dev/ui` 404 in prod; minimal health check |
| Firewall origin | N/A | Vercel-hosted, no exposed origin server; documented for self-hosted Docker |
| Memory cap | P12 | Vercel function limits; Docker `--memory` + `--max-old-space-size` for self-hosting |
| Update dependencies | P0 | Renovate, `pnpm audit`, lockfile, min release age |
| Offsite encrypted backups | P12 | Nightly `pg_dump` workflow + Neon PITR |
| Test restores | P12 | Monthly automated restore test |
| Audit log | P1 | `AuditEvent` |
| No personal data in logs | P0 | pino redaction, no request bodies |
| Alerting | P12 | Scheduled synthetic check → GitHub issue + email |
| Security contact | P0 | `SECURITY.md` + `security.txt` |

### Legal pages
| Control | Status | How |
|---|---|---|
| Terms, Privacy, sub-processors, cookie disclosure | P12 | Templates, dated separately |
| Refund policy | N/A | Free app; add if payments are introduced |
| Data processing terms | P12 | Teams may store others' data in workspaces |
| Export & deletion | P10/P12 | JSON workspace export + account deletion |

### Money
| Control | Status | How |
|---|---|---|
| One access path, server totals, webhook signatures, idempotency keys | N/A now | No payments. Recorded as mandatory rules in a billing ADR; idempotency keys already used for create actions |
| Test with two accounts | P0+ | Automated tenant-isolation suite + manual two-account test each phase |
