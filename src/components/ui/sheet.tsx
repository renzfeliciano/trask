"use client";

import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;

// Bottom is the phone default (spec §5: task detail is a bottom sheet); "right" is the desktop drawer.
const SIDES = {
  bottom: cn(
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg border-t pb-[max(1.25rem,env(safe-area-inset-bottom))]",
    "data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up",
  ),
  right: cn(
    "inset-y-0 right-0 h-dvh w-full max-w-md border-l pb-5",
    "data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in",
  ),
} as const;

export function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-surface px-5 pt-5 text-foreground shadow-(--shadow-3)",
          // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
          SIDES[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            aria-hidden="true"
            className="mx-auto -mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
          />
        )}
        {children}
        <SheetPrimitive.Close
          aria-label="Close"
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/40 hover:text-foreground md:size-9"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("pr-10 text-lg leading-snug font-semibold", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
