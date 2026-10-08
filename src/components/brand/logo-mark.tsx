import { cn } from "@/lib/cn";

// One geometry for every rendering of the mark (this component, the favicon, the app icons):
// a 64-unit rounded square with a geometric "T" centred on it.
export const LOGO_VIEWBOX = 64;
export const LOGO_TILE_RADIUS = 14;
export const LOGO_T_PATH = "M18 18h28v9h-9.5v19h-9V27H18z";
const TILE_PATH =
  "M14 0h36a14 14 0 0 1 14 14v36a14 14 0 0 1-14 14H14A14 14 0 0 1 0 50V14A14 14 0 0 1 14 0z";

type LogoMarkProps = {
  className?: string;
  /**
   * "mono" (default): the tile in currentColor with the T cut out, so it sits on any surface and
   * takes a text colour token. "brand": the app icon itself, brand gradient with a white T.
   */
  tone?: "mono" | "brand";
};

/** The TRASK mark. Decorative: pair it with visible text (the wordmark) or an aria-label nearby. */
export function LogoMark({ className, tone = "mono" }: LogoMarkProps) {
  const brand = tone === "brand";
  return (
    <svg
      data-slot="logo-mark"
      viewBox={`0 0 ${String(LOGO_VIEWBOX)} ${String(LOGO_VIEWBOX)}`}
      aria-hidden="true"
      focusable="false"
      className={cn("size-8 shrink-0", brand && "rounded-[22%]", className)}
      // The gradient is a token so the brand colour stays a one-line change; SVG fills cannot take CSS gradients.
      style={brand ? { backgroundImage: "var(--brand-gradient)" } : undefined}
    >
      {brand ? (
        <path d={LOGO_T_PATH} fill="#ffffff" />
      ) : (
        <path d={`${TILE_PATH}${LOGO_T_PATH}`} fill="currentColor" fillRule="evenodd" />
      )}
    </svg>
  );
}
