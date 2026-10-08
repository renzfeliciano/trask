import { LogoMark } from "@/components/brand/logo-mark";
import { Mascot } from "@/components/brand/mascot";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3 md:px-8 md:py-5">
        <span className="flex items-center gap-2.5">
          <LogoMark tone="brand" className="size-7" />
          <Wordmark className="text-base" />
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <Mascot state="welcome" size="lg" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Work moves here.
        </h1>
      </main>
    </div>
  );
}
