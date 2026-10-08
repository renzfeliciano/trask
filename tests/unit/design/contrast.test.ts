import { readFileSync } from "node:fs";
import Color from "colorjs.io";

const css = readFileSync("src/app/globals.css", "utf8");

/** The `--name: #hex` declarations of the first top-level rule for `selector`. */
function hexTokens(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`no top-level ${selector} rule in globals.css`);
  const body = css.slice(start, css.indexOf("}", start));
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8});/gi)) {
    tokens.set(match[1] ?? "", match[2] ?? "");
  }
  return tokens;
}

const light = hexTokens(":root");
// The dark rule only overrides; everything it does not redefine is shared with light.
const dark = new Map([...light, ...hexTokens(".dark")]);
const themes = [
  ["light", light],
  ["dark", dark],
] as const;

function contrast(tokens: Map<string, string>, text: string, background: string): number {
  const fg = tokens.get(text);
  const bg = tokens.get(background);
  if (!fg || !bg) throw new Error(`missing token --${fg ? background : text}`);
  return new Color(fg).contrast(new Color(bg), "WCAG21");
}

// [text or indicator token, background token]
const TEXT_PAIRS = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted-foreground", "background"],
  ["muted-foreground", "surface"],
  ["primary-foreground", "primary"],
  ["primary-text", "background"],
  ["primary-text", "surface"],
  ["danger-foreground", "danger"],
  // Text on yellow and on the secondary violet is always dark, in both themes (spec: "dark text 10.4:1").
  ["highlight-foreground", "highlight"],
  ["secondary-foreground", "secondary"],
  ["foreground", "accent"],
  ...Array.from({ length: 10 }, (_, i) => ["label-foreground", `label-${String(i + 1)}`] as const),
] as const;

const NON_TEXT_PAIRS = [
  ["ring", "background"],
  ["ring", "surface"],
  ["input", "surface"],
  ["input", "background"],
] as const;

describe.each(themes)("%s theme", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (text, background) => {
    expect(contrast(tokens, text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)("%s on %s meets 3:1", (indicator, background) => {
    expect(contrast(tokens, indicator, background)).toBeGreaterThanOrEqual(3);
  });
});

describe("light theme", () => {
  // In light mode the body ink itself is the dark text, so it must work on the yellow and violet fills directly.
  it.each([
    ["foreground", "highlight"],
    ["foreground", "secondary"],
  ] as const)("%s on %s meets 4.5:1", (text, background) => {
    expect(contrast(light, text, background)).toBeGreaterThanOrEqual(4.5);
  });

  // The rule behind "fills only": violet-on-white text is unreadable, so --secondary never carries text.
  it("fails --secondary as text on the light surface", () => {
    expect(contrast(light, "secondary", "surface")).toBeLessThan(4.5);
  });
});

describe("brand values", () => {
  it("keeps the brand-board violet as primary in both themes", () => {
    expect(light.get("primary")?.toLowerCase()).toBe("#7c3aed");
    expect(dark.get("primary")?.toLowerCase()).toBe("#7c3aed");
  });

  it("collapses motion tokens under prefers-reduced-motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/--duration-fast:\s*0ms/);
    expect(reduced).toMatch(/--duration-base:\s*0ms/);
  });
});
