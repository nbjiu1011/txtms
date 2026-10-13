"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Modal, useServerError } from "@/shared/common";
import { dashboardKeys } from "@/entities/dashboard";
import { noticeApi, noticeKeys, type Notice } from "@/entities/notice";

const refresh = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: noticeKeys.all }),
    client.invalidateQueries({ queryKey: dashboardKeys.all }),
  ]);

/**
 * 게시 / 복원 run at once (nothing is lost: 게시 중지 and 삭제 undo them). A refusal (state changed elsewhere) shows the
 * server's message and reloads the notices.
 */
export function useNoticeQuickAction() {
  const client = useQueryClient();
  return async (notice: Notice, action: "publish" | "restore") => {
    try {
      await (action === "publish" ? noticeApi.publish(notice.id) : noticeApi.restore(notice.id));
      toast(action === "publish" ? "공지를 게시했습니다" : "공지를 복원했습니다. 게시하면 사용자에게 다시 보입니다");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : action === "publish" ? "공지를 게시하지 못했습니다" : "공지를 복원하지 못했습니다");
    }
    await refresh(client);
  };
}

export interface NoticeConfirm {
  notice: Notice;
  action: "unpublish" | "delete";
}

const CONFIRM = {
  unpublish: {
    title: "게시를 중지할까요?",
    description: "공지 목록과 대시보드에서 사라집니다. 언제든 다시 게시할 수 있습니다.",
    ok: "게시 중지",
    done: "공지 게시를 중지했습니다",
    fail: "공지 게시를 중지하지 못했습니다",
  },
  delete: {
    title: "공지를 삭제할까요?",
    description: "공지 관리 목록에서 사라지고 「삭제된 공지」에서 복원할 수 있습니다. 게시 중이면 게시도 중지됩니다.",
    ok: "삭제",
    done: "공지를 삭제했습니다",
    fail: "공지를 삭제하지 못했습니다",
  },
} as const;

export interface NoticeConfirmDialogProps {
  confirm: NoticeConfirm | null;
  onClose: () => void;
}

/** 게시 중지 / 삭제 confirmation (contract §22); a refusal keeps the dialog open with the server's message. */
export function NoticeConfirmDialog({ confirm, onClose }: NoticeConfirmDialogProps) {
  if (!confirm) return null;
  return <NoticeConfirmBody key={`${confirm.action}-${confirm.notice.id}`} confirm={confirm} onClose={onClose} />;
}

function NoticeConfirmBody({ confirm, onClose }: { confirm: NoticeConfirm; onClose: () => void }) {
  const client = useQueryClient();
  const text = CONFIRM[confirm.action];
  const server = useServerError(text.fail);
  return (
    <Modal
      open
      onClose={onClose}
      title={text.title}
      description={text.description}
      okLabel={text.ok}
      okVariant="warn"
      onOk={async () => {
        const { notice, action } = confirm;
        try {
          await (action === "unpublish" ? noticeApi.unpublish(notice.id) : noticeApi.remove(notice.id));
        } catch (error) {
          return server.fail(error);
        }
        await refresh(client);
        toast(text.done);
        return undefined;
      }}
    />
  );
}
