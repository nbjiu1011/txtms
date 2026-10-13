"use client";

import { Dialog } from "radix-ui";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Icon, toast } from "@/shared/ui";
import { Button, IconButton } from "./button";

export interface ModalProps {
  open: boolean;
  title: string;
  /** Sub text under the title (`.modal-h p`). */
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  /** Left side of the footer (before the spacer). */
  foot?: ReactNode;
  /** Confirm button label. Omit to render only the cancel button. */
  okLabel?: string;
  okVariant?: "pri" | "warn" | "ok" | "default";
  okDisabled?: boolean;
  /** Cancel button label (default 취소). */
  cancelLabel?: string;
  /**
   * Confirm handler. Awaited; double clicks are ignored while it runs.
   * Return `false` to keep the modal open. Thrown errors are shown as a toast and keep it open.
   */
  onOk?: () => unknown;
  /** Submit a `<form id>` in the body instead of calling `onOk`. */
  okFormId?: string;
  /** Busy state driven by the caller (e.g. form submission). */
  busy?: boolean;
  size?: "md" | "lg";
}

const INITIAL_FOCUS =
  '[data-modal-body] input:not([type=checkbox]):not([type=radio]):not([disabled]),[data-modal-body] textarea:not([disabled]),[data-modal-body] select:not([disabled])';

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "요청을 처리하지 못했습니다";
}

/**
 * `.scrim > .modal[role=dialog]` — 560px (lg 900px), on radix Dialog: Tab is trapped, Escape / scrim
 * click / 취소 close it, page scroll is locked and focus returns to the element that opened it.
 * Focus starts on the first text control of the body (or the close button).
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  foot,
  okLabel,
  okVariant = "pri",
  okDisabled,
  cancelLabel = "취소",
  onOk,
  okFormId,
  busy,
  size = "md",
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);

  const handleOk = useCallback(async () => {
    if (!onOk || runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      const result = await onOk();
      if (result !== false) onClose();
    } catch (error) {
      toast(messageOf(error));
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [onOk, onClose]);

  const isBusy = busy || running;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        {/* The scrim scrolls a modal taller than the viewport; a pointer down on it closes the modal. */}
        <Dialog.Overlay className="fixed inset-0 z-50 grid place-items-center bg-(--scrim) p-5">
          <Dialog.Content
            ref={contentRef}
            aria-modal="true"
            aria-busy={isBusy || undefined}
            {...(description ? {} : { "aria-describedby": undefined })}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              const first = contentRef.current?.querySelector<HTMLElement>(INITIAL_FOCUS);
              (first ?? closeRef.current)?.focus();
            }}
            onCloseAutoFocus={(event) => {
              // There is no radix trigger: return focus to the element that opened the modal.
              event.preventDefault();
              const opener = openerRef.current;
              if (opener && document.contains(opener)) opener.focus();
            }}
            className={cn(
              "flex max-h-[calc(100%-20px)] w-[min(560px,100%)] flex-col rounded-lg bg-surface shadow-pop outline-none",
              size === "lg" && "w-[min(900px,100%)]",
            )}
          >
            <div className="flex items-start gap-2.5 px-[22px] pt-[18px] pb-1.5">
              <div className="flex-1">
                <Dialog.Title className="m-0 flex-1 text-[18px] font-semibold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 mb-0 text-[13px] text-sub">{description}</Dialog.Description>
                ) : null}
              </div>
              <IconButton ref={closeRef} label="닫기" onClick={onClose}>
                <Icon name="x" />
              </IconButton>
            </div>
            <div className="overflow-auto px-[22px] py-3.5" data-modal-body="">
              {children}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-[22px] pt-3.5 pb-[18px]">
              {foot}
              <span className="flex-1" />
              <Button variant="ghost" onClick={onClose}>
                {cancelLabel}
              </Button>
              {okLabel ? (
                okFormId ? (
                  <Button type="submit" form={okFormId} variant={okVariant} disabled={okDisabled || isBusy}>
                    {okLabel}
                  </Button>
                ) : (
                  <Button
                    variant={okVariant}
                    disabled={okDisabled}
                    aria-disabled={isBusy || undefined}
                    onClick={handleOk}
                  >
                    {okLabel}
                  </Button>
                )
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
