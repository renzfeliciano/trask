import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: string;
  /** The next step, usually one Button that names it ("Create task"). */
  action?: ReactNode;
  /** h1 when the state is the whole page (404), h2 inside a page. */
  titleAs?: "h1" | "h2";
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  titleAs: Title = "h2",
  className,
}: EmptyStateProps) {
  return (
    <section
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center",
        className,
      )}
    >
      <Title className="text-lg leading-snug font-semibold text-foreground">{title}</Title>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex w-full justify-center md:w-auto">{action}</div>}
    </section>
  );
}
