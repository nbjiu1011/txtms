import type { AssignBody, ChangeAssignmentBody, RequestDetail, Urgency } from "@/entities/request";

export type AssignmentMode = "assign" | "change";

/** Values of the 검수자 배정 / 검수자 변경 modal (reference `reviewerPicker` + fields). */
export interface AssignmentForm {
  /** Selected reviewers in candidate order. */
  reviewerIds: number[];
  primaryId: number | null;
  /** KST date `YYYY-MM-DD` (assign only). */
  dueDate: string;
  urgency: Urgency;
  /** change only */
  reason: string;
  handover: string;
}

type AssignmentSource = Pick<RequestDetail, "reviewerIds" | "primaryReviewerId" | "dueDate" | "urgency">;

/** Starts from the current assignment (a change keeps everyone checked until edited). */
export function initialAssignmentForm(r: AssignmentSource): AssignmentForm {
  return normalizePrimary({
    reviewerIds: [...r.reviewerIds],
    primaryId: r.primaryReviewerId,
    dueDate: r.dueDate ?? "",
    urgency: r.urgency,
    reason: "",
    handover: "",
  });
}

/**
 * The primary must be one of the selected reviewers: a single selection becomes the primary
 * automatically, a primary that was unchecked is cleared (reference picker behaviour).
 */
export function normalizePrimary(form: AssignmentForm): AssignmentForm {
  if (form.reviewerIds.length === 1) return { ...form, primaryId: form.reviewerIds[0] };
  if (form.primaryId !== null && !form.reviewerIds.includes(form.primaryId)) return { ...form, primaryId: null };
  return form;
}

/** Checks or unchecks a reviewer, keeping the candidate order. */
export function toggleReviewer(
  form: AssignmentForm,
  userId: number,
  checked: boolean,
  candidateOrder: readonly number[],
): AssignmentForm {
  const set = new Set(form.reviewerIds);
  if (checked) set.add(userId);
  else set.delete(userId);
  const ordered = candidateOrder.filter((id) => set.has(id));
  return normalizePrimary({ ...form, reviewerIds: ordered });
}

const sameSet = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * First problem of the form in the server's check order, or null. Messages are the reference /
 * server texts (shown as a toast like the reference).
 */
export function validateAssignment(
  form: AssignmentForm,
  mode: AssignmentMode,
  current: Pick<RequestDetail, "reviewerIds" | "primaryReviewerId">,
): string | null {
  if (form.reviewerIds.length === 0) return "검수자를 한 명 이상 고르세요";
  if (form.primaryId === null || !form.reviewerIds.includes(form.primaryId)) return "주담당 검수자를 지정하세요";
  if (mode === "assign") {
    if (!form.dueDate) return "확정 납기를 입력하세요";
    return null;
  }
  if (!form.reason.trim()) return "변경 사유을(를) 입력하세요";
  if (!form.handover.trim()) return "인수인계 내용을(를) 입력하세요";
  if (sameSet(form.reviewerIds, current.reviewerIds) && form.primaryId === current.primaryReviewerId) {
    return "변경된 검수자나 주담당이 없습니다";
  }
  return null;
}

export function toAssignBody(form: AssignmentForm): AssignBody {
  return {
    reviewerIds: form.reviewerIds,
    primaryReviewerId: form.primaryId,
    dueDate: form.dueDate,
    urgency: form.urgency,
  };
}

export function toChangeBody(form: AssignmentForm): ChangeAssignmentBody {
  return {
    reviewerIds: form.reviewerIds,
    primaryReviewerId: form.primaryId,
    reason: form.reason.trim(),
    handover: form.handover.trim(),
  };
}

/** `{label}을(를) 입력하세요` for the first blank required text (reference `need`). */
export function firstMissing(fields: readonly (readonly [value: string, label: string])[]): string | null {
  for (const [value, label] of fields) if (!value.trim()) return `${label}을(를) 입력하세요`;
  return null;
}
