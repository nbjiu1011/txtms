"use client";

import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { ConfirmModal } from "@/shared/common";
import { requestApi } from "@/entities/request";

export interface DeleteRequestDialogProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  onDeleted: () => void;
  onStale: () => void;
}

/** 요청 삭제: a draft that was never submitted is removed for good (contract §21). */
export function DeleteRequestDialog({ open, onClose, requestId, onDeleted, onStale }: DeleteRequestDialogProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title={`${requestId} 요청을 삭제할까요?`}
      description="삭제한 요청은 되돌릴 수 없습니다. 콘텐츠와 첨부파일도 함께 삭제됩니다."
      confirmLabel="삭제"
      onConfirm={async () => {
        try {
          await requestApi.remove(requestId);
        } catch (error) {
          toast(isApiError(error) ? error.message : "요청을 삭제하지 못했습니다");
          if (isApiError(error) && (error.code === "REQUEST_STATE_CONFLICT" || error.status === 403)) onStale();
          return;
        }
        toast("요청을 삭제했습니다");
        onDeleted();
      }}
    />
  );
}
