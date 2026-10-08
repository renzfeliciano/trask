import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { Mascot } from "@/components/brand/mascot";
import { MASCOT_STATES } from "@/components/brand/mascot-manifest";
import { Wordmark } from "@/components/brand/wordmark";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { InteractivePrimitives } from "./interactive";

export const metadata = { title: "UI reference · TRASK" };

const SWATCHES = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["primary", "bg-primary"],
  ["secondary", "bg-secondary"],
  ["highlight", "bg-highlight"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["border", "bg-border"],
] as const;

// Literal class names so Tailwind sees every label utility.
const LABELS = [
  "bg-label-1",
  "bg-label-2",
  "bg-label-3",
  "bg-label-4",
  "bg-label-5",
  "bg-label-6",
  "bg-label-7",
  "bg-label-8",
  "bg-label-9",
  "bg-label-10",
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Development-only reference of every primitive and state. Flip the theme to review both. */
export default function UiReferencePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 md:px-8">
      <header className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:-mx-8 md:px-8">
        <h1 className="text-base font-semibold">UI reference</h1>
        <ThemeToggle />
      </header>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {SWATCHES.map(([name, fill]) => (
            <li key={name} className="text-sm">
              <span className={`block h-12 rounded-md border border-border ${fill}`} />
              <code className="mt-1.5 block font-mono text-muted-foreground">--{name}</code>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex flex-wrap gap-2">
          {LABELS.map((fill, index) => (
            <li
              key={fill}
              className={`rounded-full px-2.5 py-1 text-xs font-medium text-label-foreground ${fill}`}
            >
              Label {index + 1}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <p className="text-2xl font-semibold tracking-tight">Ship the onboarding checklist</p>
        <p className="mt-1 text-base">Body text sits on the background at 15:1.</p>
        <p className="mt-1 text-sm text-muted-foreground">Secondary text, never below 13 px.</p>
        <p className="mt-1 text-sm text-primary-text">
          Primary-coloured text for links and active nav.
        </p>
      </Section>

      <Section title="Brand">
        <div className="flex flex-wrap items-center gap-6">
          <LogoMark tone="brand" className="size-16" />
          <LogoMark className="size-16 text-primary" />
          <LogoMark className="size-16 text-foreground" />
          <span className="flex items-center gap-2.5">
            <LogoMark tone="brand" className="size-7" />
            <Wordmark className="text-base" />
          </span>
        </div>
      </Section>

      <Section title="Primitives">
        <InteractivePrimitives />
        <div className="mt-6 grid gap-3 md:max-w-sm">
          <Input aria-label="Task title" placeholder="Task title" />
          <Input aria-label="Due date" aria-invalid="true" defaultValue="Next Thursday-ish" />
          <Input aria-label="Disabled" disabled defaultValue="Read-only for viewers" />
        </div>
        <div className="mt-6 grid gap-2 md:max-w-sm" aria-label="Loading tasks" role="status">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Section>

      <Section title="Empty states">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            className="rounded-lg border border-border bg-surface"
            mascot="empty"
            title="Nothing here yet."
            description="Add a task to get this board moving."
          />
          <EmptyState
            className="rounded-lg border border-border bg-surface"
            mascot="no-results"
            title="Nothing found."
            description="Try a different search."
          />
        </div>
      </Section>

      <Section title="Mascot states">
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {MASCOT_STATES.map((state) => (
            <li key={state} className="flex flex-col items-center gap-2">
              <Mascot state={state} size="md" />
              <span className="flex items-center gap-2">
                <Mascot state={state} size="sm" />
                <code className="font-mono text-sm text-muted-foreground">{state}</code>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
