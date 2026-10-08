import type { ReactNode } from "react";
import { Mascot } from "@/components/brand/mascot";
import type { MascotState } from "@/components/brand/mascot-manifest";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: string;
  /** The next step, usually one Button that names it ("Create task"). */
  action?: ReactNode;
  /** Decorative; the title and description must stand on their own. */
  mascot?: MascotState;
  /** h1 when the state is the whole page (404), h2 inside a page. */
  titleAs?: "h1" | "h2";
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  mascot,
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
      {mascot && <Mascot state={mascot} size="lg" className="mb-5" />}
      <Title className="text-lg leading-snug font-semibold text-foreground">{title}</Title>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex w-full justify-center md:w-auto">{action}</div>}
    </section>
  );
}
