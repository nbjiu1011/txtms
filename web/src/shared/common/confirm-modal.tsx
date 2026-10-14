"use client";

import type { ReactNode } from "react";
import { Modal } from "./modal";

export interface ConfirmModalProps {
  open: boolean;
  /** A question that names the thing: `공지 「점검 안내」를 삭제할까요?` */
  title: string;
  /** What happens and whether it can be undone. */
  description?: ReactNode;
  /** The action as a verb: 삭제 · 제외 · 비활성화 · 게시 중지 (never "확인"). */
  confirmLabel: string;
  /** Destructive actions (default) use the warn button. */
  danger?: boolean;
  /** Awaited; return false to keep the dialog open (e.g. after a refusal). */
  onConfirm: () => unknown;
  onClose: () => void;
  /** Extra content (reason field, impact list). */
  children?: ReactNode;
  busy?: boolean;
  okDisabled?: boolean;
}

/**
 * The one confirmation of the app: every delete-like action (삭제, 제외, 비활성화, 게시 중지, 초기화 …) asks with
 * this before it runs, so they all look and read the same — a question naming the target, the consequence, and the
 * verb on a warn button next to 취소.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
  children,
  busy,
  okDisabled,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      okLabel={confirmLabel}
      okVariant={danger ? "warn" : "pri"}
      okDisabled={okDisabled}
      busy={busy}
      onOk={onConfirm}
    >
      {children}
    </Modal>
  );
}
