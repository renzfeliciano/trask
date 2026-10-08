# Mascot artwork

Files here are served at `/brand/mascot/<file>` and mapped by `src/components/brand/mascot-manifest.ts`.
The current files are interim art cut from the brand board; final exports replace them file for file.

| State      | Light file        | Dark file              |
| ---------- | ----------------- | ---------------------- |
| welcome    | `welcome.webp`    | `welcome-dark.webp`    |
| empty      | `empty.webp`      | `empty-dark.webp`      |
| creating   | `creating.webp`   | `creating-dark.webp`   |
| done       | `done.webp`       | `done-dark.webp`       |
| searching  | `searching.webp`  | `searching-dark.webp`  |
| no-results | `no-results.webp` | `no-results-dark.webp` |
| focus      | `focus.webp`      | `focus-dark.webp`      |
| error      | `error.webp`      | `error-dark.webp`      |

Export rules:

- WebP with a transparent background, square canvas.
- 3× the largest display size: 480 × 480 px (the `lg` size is 160 px).
- At most 30 KB per file.
- No text in the artwork: copy lives in code so it can be fixed and translated.
- Dark variants: lighter outline, no white halo.

When a dark file lands, set its `dark` path in the manifest. Until then dark mode reuses the light file,
and a state with no file at all falls back to the logo mark.
