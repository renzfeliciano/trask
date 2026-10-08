import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16 px text on phones stops iOS Safari zooming into the field on focus.
        "h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base text-foreground md:h-9 md:text-sm",
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
