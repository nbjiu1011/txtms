import { Tag, type TagVariant } from "@/shared/ui";
import { NOTICE_STATE_LABEL, noticeState, type Notice, type NoticeState } from "../model/types";

const VARIANT: Record<NoticeState, TagVariant> = {
  PUBLISHED: "default",
  UNPUBLISHED: "fill",
  DELETED: "hot",
};

/** 게시 / 미게시 / 삭제 tag (contract §22). */
export function NoticeStateTag({ notice }: { notice: Pick<Notice, "published" | "deleted"> }) {
  const state = noticeState(notice);
  return <Tag variant={VARIANT[state]}>{NOTICE_STATE_LABEL[state]}</Tag>;
}
