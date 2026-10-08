import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 44 px and 16 px text unless the pointer is fine: 16 px stops iOS Safari zooming into the field on focus.
        "h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base text-foreground pointer-fine:md:h-9 pointer-fine:md:text-sm",
        "transition-colors duration-(--duration-fast) placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:outline-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
