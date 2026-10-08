/** The moments the mascot may appear in (spec §5 "Brand & mascot"); anything else stays mascot-free. */
export const MASCOT_STATES = [
  "welcome",
  "empty",
  "creating",
  "done",
  "searching",
  "no-results",
  "focus",
  "error",
] as const;

export type MascotState = (typeof MASCOT_STATES)[number];

/** Files under public/; `null` means "not exported yet": light falls back to the logo mark, dark reuses light. */
type MascotAsset = { light: string | null; dark: string | null };

// Interim art cut from the brand board. Final exports replace the files one for one (see public/brand/mascot/README.md);
// add a `dark` path here when a state's dark variant lands.
export const MASCOT_MANIFEST: Record<MascotState, MascotAsset> = {
  welcome: { light: "/brand/mascot/welcome.webp", dark: null },
  empty: { light: "/brand/mascot/empty.webp", dark: null },
  creating: { light: "/brand/mascot/creating.webp", dark: null },
  done: { light: "/brand/mascot/done.webp", dark: null },
  searching: { light: "/brand/mascot/searching.webp", dark: null },
  "no-results": { light: "/brand/mascot/no-results.webp", dark: null },
  focus: { light: "/brand/mascot/focus.webp", dark: null },
  error: { light: "/brand/mascot/error.webp", dark: null },
};
