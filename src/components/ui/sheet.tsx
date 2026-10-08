"use client";

import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;

// Bottom is the phone default (spec §5: task detail is a bottom sheet); "right" is the desktop drawer.
// The page uses viewport-fit=cover, so each side pads itself clear of the notch and home indicator.
const SIDES = {
  bottom: {
    panel: cn(
      "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg border-t pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
      "data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up",
    ),
    close: "top-2",
  },
  right: {
    panel: cn(
      "inset-y-0 right-0 h-dvh w-full max-w-md border-l pr-[max(1.25rem,env(safe-area-inset-right))]",
      "pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]",
      "data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in",
    ),
    close:
      "top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))]",
  },
} as const;

export function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES }) {
  // eslint-disable-next-line security/detect-object-injection -- typed union key, not user input
  const layout = SIDES[side];
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-surface px-5 text-foreground shadow-(--shadow-3)",
          layout.panel,
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
          className={cn(
            "absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/40 hover:text-foreground pointer-fine:md:size-9",
            layout.close,
          )}
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
