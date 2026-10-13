"use client";

import { Dialog } from "radix-ui";
import { useRef, type ReactNode } from "react";
import { Icon } from "@/shared/ui";
import { IconButton } from "./button";

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * `.drawer[role=dialog]` — right side sheet (min(420px,100%)), on a non-modal radix Dialog: the page
 * behind stays usable (no scrim, clicks outside keep it open) and Escape closes it.
 */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={() => {
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // There is no radix trigger: return focus to the element that opened the drawer.
            event.preventDefault();
            const opener = openerRef.current;
            if (opener && document.contains(opener)) opener.focus();
          }}
          className="fixed top-0 right-0 bottom-0 z-45 flex w-[min(420px,100%)] flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top,0px)] shadow-pop outline-none"
        >
          <div className="flex items-center gap-2 border-b border-line px-[18px] py-4">
            <Dialog.Title asChild>
              <h3 className="m-0 flex-1 text-[16px]">{title}</h3>
            </Dialog.Title>
            <IconButton label="닫기" onClick={onClose}>
              <Icon name="x" />
            </IconButton>
          </div>
          <div className="flex-1 overflow-auto p-[18px]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
