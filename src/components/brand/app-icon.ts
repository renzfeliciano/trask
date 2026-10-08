import { LOGO_T_PATH, LOGO_TILE_RADIUS, LOGO_VIEWBOX } from "@/components/brand/logo-mark";

/**
 * Brand-board colours for files that cannot read CSS tokens (icons, the web manifest). They mirror
 * --primary and --secondary in globals.css; tests/unit/brand/app-icon.test.ts keeps them in sync.
 */
export const BRAND_COLORS = { primary: "#7c3aed", secondary: "#a78bfa" } as const;

/**
 * The app icon as standalone SVG: brand gradient tile, white T. `fullBleed` drops the rounded corners
 * for platforms that apply their own mask (iOS home screen, Android maskable icons); the T already
 * sits inside the 80% safe zone those masks keep.
 */
export function appIconSvg({ fullBleed }: { fullBleed: boolean }): string {
  const size = String(LOGO_VIEWBOX);
  const radius = fullBleed ? "" : ` rx="${String(LOGO_TILE_RADIUS)}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${BRAND_COLORS.primary}"/>`,
    `<stop offset="1" stop-color="${BRAND_COLORS.secondary}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${size}" height="${size}"${radius} fill="url(#g)"/>`,
    `<path d="${LOGO_T_PATH}" fill="#ffffff"/>`,
    `</svg>`,
  ].join("");
}

/** The icon as a data URI, for ImageResponse to rasterize into PNG sizes. */
export function appIconDataUri(options: { fullBleed: boolean }): string {
  return `data:image/svg+xml;base64,${btoa(appIconSvg(options))}`;
}
