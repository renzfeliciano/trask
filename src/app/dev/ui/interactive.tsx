"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** The parts of /dev/ui that need client-side state: overlays, toasts and retry. */
export function InteractivePrimitives() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <Button>Create task</Button>
        <Button variant="secondary">Move to Review</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete board</Button>
        <Button disabled>Saving</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Delete column</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete the Review column?</DialogTitle>
            <DialogDescription>
              Its 4 tasks move to Backlog. You can undo this for 10 seconds.
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep column</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger">Delete column</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open task sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Draft Q4 hiring plan</SheetTitle>
            <SheetDescription>
              Phone layout: the task detail opens as a bottom sheet.
            </SheetDescription>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open task drawer</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetTitle>Draft Q4 hiring plan</SheetTitle>
            <SheetDescription>
              Desktop layout: the task detail opens as a right drawer.
            </SheetDescription>
          </SheetContent>
        </Sheet>

        <Button
          variant="secondary"
          onClick={() => {
            toast("Task moved to Review.", { description: "Draft Q4 hiring plan" });
          }}
        >
          Show toast
        </Button>
      </div>

      <ErrorState
        className="rounded-lg border border-border bg-surface md:max-w-sm"
        description="We couldn't load this board."
        onRetry={() => {
          toast("Retrying…");
        }}
      />
    </div>
  );
}
