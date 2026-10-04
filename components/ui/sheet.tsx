"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";
import { getAppScreen } from "@/components/PhoneFrame";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, hideHandle, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { hideHandle?: boolean }) {
  return (
    <DialogPrimitive.Portal container={getAppScreen()}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88%] w-full max-w-phone overflow-y-auto rounded-t-3xl bg-background p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {!hideHandle && <div className="mx-auto mb-3 h-1.5 w-10 flex-shrink-0 rounded-full bg-border" />}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
