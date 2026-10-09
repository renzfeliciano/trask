# ADR 0008: The "no AI slop" quality bar

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

Generated code and copy drift toward the same look: purple gradients, sparkle icons, marketing-speak
taglines, filler dashboards, speculative abstractions. TRASK is a portfolio piece; it has to read as
designed by people who use it.

## Decision

- Spec §5 "Quality bar" is the rule set; `docs/content-style.md` is the working checklist.
- **Copy:** banned phrases are listed in a fenced block in `docs/content-style.md`;
  `tests/unit/content/banned-phrases.test.ts` scans every file under `src/` for them (whole words,
  case-insensitive, emoji anywhere). Buttons name the action; empty and error states use the mascot copy
  word for word.
- **Visual:** violet is an accent; the brand gradient appears only on the logo mark and the landing
  hero; three radii, shadows only for elevation; the mascot is the only illustration and decorative
  (`alt=""`). The wordmark is Geist text until a designer supplies vector art.
- **Code:** no unused files, exports or dependencies (`knip` in CI); comments explain why; interfaces
  only with a second implementation or a test double (ADR 0006).
- **Docs:** short, specific to TRASK, with what was rejected.

## Rejected alternatives

- **A UI kit used as-is:** its default look is exactly the template feel to avoid. shadcn components
  are copied and rewritten to TRASK tokens instead.
- **Review by eye only:** banned phrases come back unnoticed; a test is cheaper than vigilance.

## Consequences

- The phrase test covers `src/**` only. Docs, commit messages and seed data follow the same rules by
  review.
- Each phase ends with a screenshot review at phone and desktop widths, light and dark, by a person.
