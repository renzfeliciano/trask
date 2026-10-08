import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const styleGuide = readFileSync("docs/content-style.md", "utf8");

function bannedPhrases(): string[] {
  const block = /```banned\n([\s\S]*?)```/.exec(styleGuide.replaceAll("\r\n", "\n"));
  if (!block?.[1]) throw new Error("docs/content-style.md has no ```banned block");
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;
const isWordChar = (char: string | undefined) => char !== undefined && WORD_CHAR.test(char);

/**
 * Word entries ("elevate", "dive in") match whole words only, so "elevation" or `isUnlocked` pass;
 * symbol entries (emoji) match anywhere. Case-insensitive.
 */
function containsPhrase(text: string, phrase: string): boolean {
  const haystack = text.toLowerCase();
  const needle = phrase.toLowerCase();
  if (!isWordChar(needle[0]) || !isWordChar(needle.at(-1))) return haystack.includes(needle);
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    if (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[at + needle.length])) return true;
  }
  return false;
}

describe("containsPhrase", () => {
  it.each([
    ["Elevate your work", "elevate"],
    ["Let's DIVE IN.", "dive in"],
    ["a game-changer!", "game-changer"],
    ["Ship it 🚀", "🚀"],
    ["Ship it🚀now", "🚀"],
  ])("finds %j for %j", (text, phrase) => {
    expect(containsPhrase(text, phrase)).toBe(true);
  });

  it.each([
    ["Elevation comes only from shadows", "elevate"],
    ["const isUnlocked = true", "unlock"],
    ["undive into", "dive in"],
  ])("ignores %j for %j", (text, phrase) => {
    expect(containsPhrase(text, phrase)).toBe(false);
  });
});

describe("banned phrases", () => {
  it("lists the phrases the spec bans", () => {
    expect(bannedPhrases()).toEqual(
      expect.arrayContaining([
        "unlock",
        "supercharge",
        "seamless",
        "seamlessly",
        "effortless",
        "effortlessly",
        "elevate",
        "revolutionize",
        "game-changer",
        "dive in",
        "lorem ipsum",
        "🚀",
        "✨",
      ]),
    );
  });

  it("appear nowhere in src", () => {
    const phrases = bannedPhrases();
    const files = fg.sync("src/**/*.{ts,tsx}", { cwd: repoRoot });
    expect(files.length).toBeGreaterThan(0);

    const hits = files.flatMap((file) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from the glob above
      const text = readFileSync(path.join(repoRoot, file), "utf8").replaceAll("\r\n", "\n");
      return phrases
        .filter((phrase) => containsPhrase(text, phrase))
        .map((phrase) => `${file}: ${phrase}`);
    });
    expect(hits).toEqual([]);
  });
});
