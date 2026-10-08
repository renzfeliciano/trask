import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        titleAs="h1"
        mascot="error"
        title="Well… that wasn't supposed to happen."
        description="We couldn't find that page."
        action={
          <Button asChild variant="secondary" className="w-full md:w-auto">
            <Link href="/">Go to home page</Link>
          </Button>
        }
      />
    </main>
  );
}
