import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "icon";

// Flat fills and 1 px borders: no shadows, no gradients. Hover swaps to a solid shade (checked for
// contrast like every other pair) or a tint; focus uses the global ring.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-accent/40",
  ghost: "text-foreground hover:bg-accent/40",
  danger: "bg-danger text-danger-foreground hover:bg-danger-hover",
};

// 44 px touch targets everywhere a finger may be the pointer (phones and tablets); only a fine pointer
// (mouse, trackpad) on a wide screen gets the denser 36 px.
const SIZES: Record<ButtonSize, string> = {
  default: "h-11 px-4 pointer-fine:md:h-9 pointer-fine:md:px-3.5",
  icon: "size-11 pointer-fine:md:size-9",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the child element (a link, say) with button styling instead of a <button>. */
  asChild?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="button"
      // A bare <button> inside a form submits it; make that an explicit choice.
      type={asChild ? type : (type ?? "button")}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap",
        "transition-colors duration-(--duration-fast) select-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
        VARIANTS[variant],
        // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
