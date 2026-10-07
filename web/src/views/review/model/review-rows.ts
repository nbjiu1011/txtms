import { formatDate } from "@/shared/lib";
import { URGENCY_LABEL, formatVolume, type RequestSummary } from "@/entities/request";

export type ReviewSub = "mine" | "assign";
export type MineFilter = "active" | "done";

/** Sub tabs of the 검수 screen: reviewers get 내 검수, the lead 배정 관리 (both when both). */
export function reviewSubTabs(roles: { reviewer: boolean; lead: boolean }): ReviewSub[] {
  return [...(roles.reviewer ? (["mine"] as const) : []), ...(roles.lead ? (["assign"] as const) : [])];
}

/** One row of the 내 검수 table (reference `vReview` mine table). */
export interface MyReviewRow {
  id: string;
  title: string;
  recall: boolean;
  status: RequestSummary["status"];
  /** 주담당 (bold) or 공동 검수. */
  role: "주담당" | "공동 검수";
  round: string;
  volume: string;
  due: string;
  /** 지연 wins over 임박. */
  dueTag: "지연" | "임박" | null;
}

export function toMyReviewRow(r: RequestSummary, meId: number): MyReviewRow {
  return {
    id: r.id,
    title: r.title || "제목 없는 요청",
    recall: r.recallRequested,
    status: r.status,
    role: r.primaryReviewerId === meId ? "주담당" : "공동 검수",
    round: `${r.round}차`,
    volume: formatVolume(r.volume),
    due: formatDate(r.dueDate),
    dueTag: r.overdue ? "지연" : r.dueSoon ? "임박" : null,
  };
}

/** Meta line of a 배정 관리 item: `{id}  {요청자}  희망 {날짜}  확정 {날짜}  {긴급도}`. */
export function assignQueueMeta(r: RequestSummary, requesterName: string): string {
  return `${r.id}  ${requesterName}  희망 ${formatDate(r.hopeDueDate)}  확정 ${formatDate(r.dueDate)}  ${URGENCY_LABEL[r.urgency]}`;
}
