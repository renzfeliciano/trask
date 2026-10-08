import Image from "next/image";
import { LogoMark } from "@/components/brand/logo-mark";
import { MASCOT_MANIFEST, type MascotState } from "@/components/brand/mascot-manifest";
import { cn } from "@/lib/cn";

type MascotSize = "sm" | "md" | "lg";

// sm 40 px (toasts, inline), md 120 px (phone), lg 160 px (empty and error states), which mobile-first
// starts at the phone size and grows from `md`. Intrinsic sizes are the largest box each one gets.
const SIZES: Record<MascotSize, { box: string; px: number }> = {
  sm: { box: "size-10", px: 40 },
  md: { box: "size-30", px: 120 },
  lg: { box: "size-30 md:size-40", px: 160 },
};

type MascotProps = {
  state: MascotState;
  size?: MascotSize;
  className?: string;
};

/**
 * The single expressive element of the UI, for the moments listed in MASCOT_STATES. Always
 * decorative: the surrounding text must say everything the picture does.
 */
export function Mascot({ state, size = "md", className }: MascotProps) {
  // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
  const { light, dark } = MASCOT_MANIFEST[state];
  // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
  const { box, px } = SIZES[size];
  // Only the welcome screen shows the mascot above the fold on first load.
  const loading = state === "welcome" ? "eager" : "lazy";

  return (
    <span
      data-slot="mascot"
      data-state={state}
      aria-hidden="true"
      className={cn("inline-flex shrink-0 select-none", box, className)}
    >
      {light === null ? (
        <LogoMark className="size-full text-accent" />
      ) : (
        <>
          <Image
            src={light}
            alt=""
            aria-hidden="true"
            width={px}
            height={px}
            loading={loading}
            className={cn("size-full object-contain", dark && "dark:hidden")}
          />
          {dark && (
            <Image
              src={dark}
              alt=""
              aria-hidden="true"
              width={px}
              height={px}
              loading={loading}
              className="hidden size-full object-contain dark:block"
            />
          )}
        </>
      )}
    </span>
  );
}
