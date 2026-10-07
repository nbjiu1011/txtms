import type { DeactivationImpact, Member } from "@/entities/user";
import type { RequestSummary } from "@/entities/request";
import { firstMissing } from "@/shared/lib";

export const DEACTIVATION_PRE_BLOCK =
  "확인 요청·승인 대기 중에는 담당자를 변경할 수 없습니다. 해당 업무를 먼저 처리하세요";

/** Reference J:212: assigned to a request in 확인 요청 or 승인 대기 → refused before the modal opens. */
export function preBlocked(impact: DeactivationImpact): boolean {
  return impact.reviewing.some((r) => r.status === "CONFIRMING" || r.status === "APPROVAL_WAITING");
}

/** Reviews handed to the substitute (검수 중). */
export function handoverRequests(impact: DeactivationImpact): RequestSummary[] {
  return impact.reviewing.filter((r) => r.status === "IN_REVIEW");
}

/** A substitute and a handover note are required when reviews or lead projects move. */
export function needsSubstitute(impact: DeactivationImpact): boolean {
  return handoverRequests(impact).length > 0 || impact.leadProjects.length > 0;
}

/** Blocking items the server will refuse (shown in the modal before confirming). */
export function blockingItems(impact: DeactivationImpact): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (impact.requesting.length) items.push({ label: "요청자로 진행 중", value: impact.requesting.map((r) => r.id).join(", ") });
  if (impact.lastApproverProjects.length)
    items.push({ label: "마지막 승인자", value: impact.lastApproverProjects.map((p) => p.name).join(", ") });
  if (impact.lastAdmin) items.push({ label: "마지막 고객사 관리자", value: "예" });
  return items;
}

/**
 * Substitute candidates (reference): same customer, active (not pending), not the user, reviewer in
 * some project.
 */
export function substituteCandidates(members: Member[], userId: number): Member[] {
  return members.filter(
    (m) =>
      m.user.active &&
      !m.pending &&
      m.user.id !== userId &&
      m.projects.some((p) => p.roles.includes("REVIEWER")),
  );
}

/**
 * Checks at 비활성화 in the reference order: a requester of a handed-over request (or of its project)
 * cannot substitute, the last approver blocks, then the required fields.
 */
export function deactivationProblem(
  impact: DeactivationImpact,
  substitute: Member | undefined,
  handover: string,
): string | null {
  if (substitute) {
    const asRequester = handoverRequests(impact).some(
      (r) =>
        r.requesterId === substitute.user.id ||
        substitute.projects.some((p) => p.projectId === r.projectId && p.roles.includes("REQUESTER")),
    );
    if (asRequester) return "해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다";
  }
  if (impact.lastApproverProjects.length) return "마지막 승인자입니다. 새 승인자를 먼저 지정하세요";
  if (!needsSubstitute(impact)) return null;
  return firstMissing([
    [substitute?.user.id, "대체자"],
    [handover, "인수인계 내용"],
  ]);
}
