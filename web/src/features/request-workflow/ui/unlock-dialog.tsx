"use client";

import { Modal, toast } from "@/shared/ui";
import { requestApi } from "@/entities/request";
import { handleWorkflowError } from "../model/workflow-error";

export interface UnlockDialogProps {
  /** Content whose lock is released; null = closed. */
  target: { requestId: string; contentKey: string; holderName: string } | null;
  onClose: () => void;
  /** Reload the request after the release (or a failure). */
  onDone: () => void;
}

/** 편집 잠금 강제 해제 (대표 검수자 · 고객사 관리자). */
export function UnlockDialog({ target, onClose, onDone }: UnlockDialogProps) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title="편집 잠금을 해제할까요?"
      description={target ? `${target.holderName}님이 저장하지 않은 수정 내용은 반영되지 않습니다.` : undefined}
      okLabel="잠금 해제"
      onOk={async () => {
        if (!target) return undefined;
        try {
          await requestApi.forceReleaseLock(target.requestId, target.contentKey);
          toast("편집 잠금을 해제했습니다");
          onDone();
        } catch (error) {
          handleWorkflowError(error, onDone);
        }
        return undefined;
      }}
    />
  );
}
