import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Placeholder for content that is loading. Decorative: the loading state is announced elsewhere. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-sm bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
