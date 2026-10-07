import type { ButtonVariant } from "@/shared/ui";
import type { RequestAction } from "@/entities/request";

export interface HeaderActionButton {
  action: RequestAction;
  label: string;
  variant: ButtonVariant;
  /** `more` (ghost, left) or `acts` (primary group, right). */
  group: "more" | "acts";
}

/** Header buttons in reference order (`vRequest` B:1120-1131). */
export const HEADER_ACTIONS: readonly HeaderActionButton[] = [
  { action: "CLONE", label: "복제", variant: "ghost", group: "more" },
  { action: "FOLLOW_UP", label: "후속 요청 작성", variant: "ghost", group: "more" },
  { action: "SUBMIT", label: "검수 요청", variant: "pri", group: "acts" },
  { action: "CANCEL", label: "요청 취소", variant: "warn", group: "acts" },
  { action: "RECALL", label: "회수 요청", variant: "warn", group: "acts" },
  { action: "ASSIGN", label: "검수자 배정", variant: "pri", group: "acts" },
  { action: "CHANGE_ASSIGNMENT", label: "검수자 변경", variant: "default", group: "acts" },
  { action: "EDIT_DUE", label: "납기·긴급도", variant: "default", group: "acts" },
  { action: "COMPLETE", label: "검수 완료", variant: "ok", group: "acts" },
  { action: "REVISE", label: "수정 요청", variant: "default", group: "acts" },
  { action: "APPROVE", label: "승인", variant: "ok", group: "acts" },
];

/** Buttons to render: allowed by the server and implemented in this build. */
export function headerButtons(performable: ReadonlySet<RequestAction>): HeaderActionButton[] {
  return HEADER_ACTIONS.filter((b) => performable.has(b.action));
}
