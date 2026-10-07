import { formatDate } from "@/shared/lib";
import type { RequestSummary } from "@/entities/request";

/** One row of the 승인 대기 table (reference `vApproval`). */
export interface ApprovalQueueRow {
  id: string;
  title: string;
  round: string;
  primaryReviewerId: number | null;
  /** `{n}건 v1 v2 …` */
  contents: string;
  due: string;
  /** I am an eligible approver of this request (`RequestSummary.approvable`, contract §14.2). */
  canProcess: boolean;
}

export function toApprovalQueueRow(r: RequestSummary): ApprovalQueueRow {
  return {
    id: r.id,
    title: r.title || "제목 없는 요청",
    round: `${r.round}차`,
    primaryReviewerId: r.primaryReviewerId,
    contents: [`${r.contentCount}건`, ...r.contentVersions.map((v) => `v${v}`)].join(" "),
    due: formatDate(r.dueDate),
    canProcess: r.approvable,
  };
}

/** The project has at least one active approver (else completion cannot move to 승인 대기). */
export function hasActiveApprover(
  members: readonly { userId: number; roles: readonly string[] }[],
  isActive: (userId: number) => boolean,
): boolean {
  return members.some((m) => m.roles.includes("APPROVER") && isActive(m.userId));
}
