"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib";
import { Button, IconButton } from "../button";
import { Icon } from "../icons/icons";
import { ESCAPE_PRIORITY, useEscapeLayer } from "./escape-stack";
import { toast } from "./toast";
import { useMounted } from "./use-mounted";
import styles from "./overlay.module.css";

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

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const INITIAL_FOCUS =
  '[data-modal-body] input:not([type=checkbox]):not([type=radio]):not([disabled]),[data-modal-body] textarea:not([disabled]),[data-modal-body] select:not([disabled])';

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "요청을 처리하지 못했습니다";
}

/**
 * `.scrim > .modal[role=dialog]` — 560px (lg 900px). Focus moves to the first text control
 * (or the close button), Tab is trapped inside, Escape / scrim click / 취소 close it, and focus
 * returns to the element that opened it.
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
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEscapeLayer(open, ESCAPE_PRIORITY.modal, onClose);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(INITIAL_FOCUS);
    (first ?? closeRef.current)?.focus();
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest("[hidden],[inert]"),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open || !mounted) return null;
  const isBusy = busy || running;

  return createPortal(
    <div
      className={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cn(styles.modal, size === "lg" && styles.lg)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={isBusy || undefined}
        onKeyDown={onKeyDown}
      >
        <div className={styles.modalH}>
          <div className={styles.modalTitle}>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descId}>{description}</p> : null}
          </div>
          <IconButton ref={closeRef} label="닫기" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </div>
        <div className={styles.modalB} data-modal-body="">{children}</div>
        <div className={styles.modalF}>
          {foot}
          <span className={styles.sp} />
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          {okLabel ? (
            okFormId ? (
              <Button type="submit" form={okFormId} variant={okVariant} disabled={okDisabled || isBusy}>
                {okLabel}
              </Button>
            ) : (
              <Button variant={okVariant} disabled={okDisabled} aria-disabled={isBusy || undefined} onClick={handleOk}>
                {okLabel}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
