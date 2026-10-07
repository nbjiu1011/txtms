import { FINAL_STATUSES, type RequestDetail } from "./types";

/**
 * Why the content editor is read-only for the current user (reference `roEditReason`).
 * Display text only — whether editing is allowed comes from `allowedActions`.
 */
export function readOnlyReason(
  request: Pick<RequestDetail, "status" | "recallRequested" | "requesterId">,
  meId: number,
): string {
  const { status } = request;
  if (status === "WAITING") return "배정 대기 중에는 편집할 수 없습니다. 수정이 필요하면 요청을 취소한 뒤 다시 작성하세요.";
  if (status === "IN_REVIEW" && request.recallRequested && request.requesterId === meId)
    return "회수 요청 처리 중에는 편집할 수 없습니다.";
  if (status === "IN_REVIEW") return "배정된 검수자만 검수 중에 편집할 수 있습니다.";
  if (status === "CONFIRMING") return "확인 요청 중에는 요청자만 본인 콘텐츠를 수정할 수 있습니다.";
  if (status === "APPROVAL_WAITING") return "승인 대기 중에는 콘텐츠 버전이 고정됩니다.";
  if (FINAL_STATUSES.includes(status)) return "완료된 요청입니다. 수정은 후속 요청으로 시작합니다.";
  return "이 요청을 편집할 권한이 없습니다.";
}

/**
 * The user may edit content per policy: `EDIT_CONTENT` allowed and not the requester while their own
 * recall is pending (reference `editableBase`).
 */
export function canEditContentByPolicy(
  request: Pick<RequestDetail, "status" | "recallRequested" | "requesterId" | "allowedActions">,
  meId: number,
): boolean {
  if (!request.allowedActions.includes("EDIT_CONTENT")) return false;
  return !(request.recallRequested && request.requesterId === meId && request.status === "IN_REVIEW");
}
