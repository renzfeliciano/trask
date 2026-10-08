import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ErrorStateProps = {
  /** Defaults to the spec's error line; the description says what went wrong in plain words. */
  title?: string;
  description: string;
  /** When set, offers "Try again". Leave it out when retrying cannot help. */
  onRetry?: () => void;
  /** h1 when the state is the whole page (error boundary), h2 inside a page. */
  titleAs?: "h1" | "h2";
  className?: string;
};

export function ErrorState({
  title = "Well… that wasn't supposed to happen.",
  description,
  onRetry,
  titleAs: Title = "h2",
  className,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      data-slot="error-state"
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center",
        className,
      )}
    >
      <Title className="text-lg leading-snug font-semibold text-foreground">{title}</Title>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5 w-full md:w-auto" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}
