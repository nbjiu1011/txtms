"use client";

import { Popover as RPopover } from "radix-ui";
import { useMemo, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface PopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  /** Width used for placement and rendering (reference: 380 default, 320 add-tab, 300 persona). */
  width?: number;
  children: ReactNode;
  className?: string;
}

/**
 * `.pop[role=dialog]` — popover under an anchor element, on radix Popover: right edge aligned to the
 * anchor's right edge, 6px below it, kept 8px inside the viewport. Outside click and Escape close it;
 * a click on the anchor is left to the anchor's own toggle.
 */
export function Popover({ open, anchor, onClose, label, width = 380, children, className }: PopoverProps) {
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
  const isFromAnchor = (target: EventTarget | null) => !!anchor && target instanceof Node && anchor.contains(target);

  return (
    <RPopover.Root
      open={open && !!anchor}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {anchor ? <RPopover.Anchor virtualRef={anchorRef as { current: HTMLElement }} /> : null}
      <RPopover.Portal>
        <RPopover.Content
          aria-label={label}
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          onInteractOutside={(event) => {
            if (isFromAnchor(event.target)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            // No radix trigger to return to: give focus back to the anchor unless the user moved it.
            event.preventDefault();
            if (!document.activeElement || document.activeElement === document.body) anchor?.focus();
          }}
          style={{ "--pop-w": `${width}px` } as CSSProperties}
          className={cn(
            "z-40 flex max-h-[70vh] w-(--pop-w) flex-col rounded-md border border-line bg-surface shadow-pop outline-none",
            className,
          )}
        >
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/** `.pop-h` — header row; a `<b>` child takes the remaining width. */
export function PopoverHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2 border-b border-line px-3.5 py-3 [&>b]:flex-1", className)}
      {...rest}
    />
  );
}

/** `.pop-b` — scrollable body. */
export function PopoverBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-auto", className)} {...rest} />;
}

/** Small faint section label inside a popover body. */
export function PopoverSection({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-pop-section=""
      className={cn(
        "px-3.5 pt-2 pb-0.5 text-[12px] text-faint",
        // a section that follows another section or an item gets more room above it
        "[[data-pop-section]+&]:pt-2.5 [button+&]:pt-2.5",
        className,
      )}
      {...rest}
    />
  );
}

/** `.vitem` — clickable popover row. */
export function PopoverItem({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 border-0 border-b border-line bg-transparent px-3 py-[9px]",
        "text-left text-[13px] hover:bg-sunk [&_svg]:size-4 [&_svg]:flex-none",
        className,
      )}
      {...rest}
    />
  );
}
