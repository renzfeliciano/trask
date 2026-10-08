import { cn } from "@/lib/cn";

/**
 * The TRASK wordmark: real text set in Geist, so it stays selectable, translatable-safe and crisp
 * at every size, and takes its colour from the surrounding text token.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      data-slot="wordmark"
      className={cn("font-sans text-xl leading-none font-bold tracking-[0.08em]", className)}
    >
      TRASK
    </span>
  );
}
