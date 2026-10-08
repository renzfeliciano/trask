import { readFileSync } from "node:fs";
import { appIconSvg, BRAND_COLORS } from "@/components/brand/app-icon";

describe("app icon", () => {
  it("serves the favicon from the same geometry as the logo mark", () => {
    // src/app/icon.svg is a static file Next serves as-is; regenerate it from appIconSvg() when the mark changes.
    expect(readFileSync("src/app/icon.svg", "utf8").trim()).toBe(appIconSvg({ fullBleed: false }));
  });

  it("uses the brand-board violets from the design tokens", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    expect(root).toContain(`--primary: ${BRAND_COLORS.primary};`);
    expect(root).toContain(`--secondary: ${BRAND_COLORS.secondary};`);
    expect(root).toContain(
      `--brand-gradient: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);`,
    );
  });

  it("keeps rounded corners only on the non-masked variant", () => {
    expect(appIconSvg({ fullBleed: false })).toContain('rx="14"');
    expect(appIconSvg({ fullBleed: true })).not.toContain("rx=");
  });
});
