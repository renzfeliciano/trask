# ADR 0005: Mobile first

- **Status:** Accepted (Phase 0, 2026-10-08)

## Context

People capture and move tasks from their phones as often as from a desk. Desktop-first layouts squeezed
onto a phone produce tiny targets and horizontal scrolling.

## Decision

- Base styles target phones; `md` and `lg` add layout. Phone navigation is a bottom bar, the board shows
  one column at a time, and task detail is a bottom sheet (spec §5 "Responsive behavior").
- Touch targets are at least 44 px, also where a desktop design would use 36 px. Muted text is never
  smaller than 13 px. Layouts pad with `env(safe-area-inset-*)` (the root viewport sets
  `viewport-fit=cover`); toasts and sheets respect the insets.
- Drag and drop is never the only way to move a task ("Move to…" on phones).
- Playwright runs `mobile-chrome` (Pixel 7) and `mobile-safari` (iPhone 15) before `desktop-chrome`,
  with axe-core checks in light and dark.
- Tokens (`src/app/globals.css`) are checked for WCAG AA contrast in both themes by
  `tests/unit/design/contrast.test.ts`.

## Rejected alternatives

- **Desktop first, responsive later:** retrofitting touch targets and sheets touches every component.
- **A separate mobile app:** a second codebase; a responsive web app plus an installable manifest covers
  Phase 0–12 needs.

## Consequences

- Some desktop controls are larger than a dense desktop UI would choose.
- Text inputs draw their focus ring with offset 0 (the border turns to the ring color) instead of the
  2 px offset used elsewhere; this is the one documented exception to the spec's focus rule.
- WebKit (mobile Safari) is exercised only in CI; the build sandbox could not launch it.
- A human visual check at 375 px and 1280 px, light and dark, is still part of every phase review;
  automated tests do not judge layout quality.
