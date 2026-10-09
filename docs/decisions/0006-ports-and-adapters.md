# ADR 0006: Ports and adapters for third-party capabilities

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

The zero-cost rule means every capability must run locally for free, with a paid option possible later.
Library upgrades should touch one folder, and unit tests need fakes without module mocking.

## Decision

- A port is an interface in `src/server/ports/`; an adapter implements it in `src/server/adapters/`.
- Phase 0 defines two ports, both with a real consumer:
  - `Logger`, implemented with pino (`pino-logger.ts`): JSON, redaction of passwords, tokens, cookies and
    auth headers, created lazily by `getLogger()` so importing never needs env.
  - `AuthPort`, consumed by `createAction`; the Better Auth adapter comes in Phase 1. Tests pass fakes
    through `createActionFactory(deps)`.
- Email, storage, rate limiting, realtime, AI, metrics and error reporting get a port when the phase
  that uses them starts, not before.
- Third-party code stays behind its wrapper: pino only in the Logger adapter, Prisma only in `src/db`
  and repositories, Radix only in `src/components/ui`.

## Rejected alternatives

- **All ports up front (spec §2 list):** interfaces with no caller are speculative code that knip and the
  quality bar reject.
- **Direct library calls everywhere:** a pino or Better Auth major upgrade would touch every module.

## Consequences

- Health checking follows the same rule: route → `server/health/service.ts` → `repository.ts`, so even
  `SELECT 1` goes through a repository.
- Redaction covers listed keys at the top level and one level down. Deeper paths (`err.cause.*`), arrays
  and request bodies are not covered; `createAction` therefore logs only allow-listed fields and never a
  whole error or input.
