"use client";

import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Modal } from "@/shared/common";
import { requestApi, type RequestDetail } from "@/entities/request";

export interface CancelRequestDialogProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  rowVersion: () => number;
  onCancelled: (detail: RequestDetail) => void;
  onStale: () => void;
}

/** 요청 취소 (배정 대기 → 작성 중) with the reference confirmation. */
export function CancelRequestDialog({ open, onClose, requestId, rowVersion, onCancelled, onStale }: CancelRequestDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="검수 요청을 취소할까요?"
      description="검수자가 배정되기 전이라 바로 취소됩니다. 요청은 작성 중으로 돌아갑니다."
      okLabel="요청 취소"
      okVariant="warn"
      onOk={async () => {
        try {
          onCancelled(await requestApi.cancel(requestId, rowVersion()));
        } catch (error) {
          toast(isApiError(error) ? error.message : "요청을 취소하지 못했습니다");
          if (isApiError(error) && (error.code === "REQUEST_STATE_CONFLICT" || error.status === 403)) onStale();
        }
      }}
    />
  );
}
