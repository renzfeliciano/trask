"use client";

import { ErrorState } from "@/components/ui/error-state";

// Shows no error details on purpose: messages can carry internals, and server-side failures are
// logged where they happen.
export default function RouteError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <ErrorState
        titleAs="h1"
        mascot="error"
        description="Something went wrong on our side."
        onRetry={retry}
      />
    </main>
  );
}
