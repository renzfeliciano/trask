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
    const phrases = bannedPhrases().map((phrase) => phrase.toLowerCase());
    const files = fg.sync("src/**/*.{ts,tsx}", { cwd: repoRoot });
    expect(files.length).toBeGreaterThan(0);

    const hits = files.flatMap((file) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from the glob above
      const text = readFileSync(path.join(repoRoot, file), "utf8")
        .replaceAll("\r\n", "\n")
        .toLowerCase();
      return phrases
        .filter((phrase) => text.includes(phrase))
        .map((phrase) => `${file}: ${phrase}`);
    });
    expect(hits).toEqual([]);
  });
});
