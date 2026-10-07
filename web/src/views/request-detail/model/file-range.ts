import type { FileMeta, FileRangePatch } from "@/entities/request";

/** Attachment range inputs as typed (strings, so an empty or partial value can be shown). */
export interface FileRangeDraft {
  totalAmount: string;
  reviewAmount: string;
  rangeNote: string;
}

export const MAX_FILE_AMOUNT = 1_000_000;
export const MAX_RANGE_NOTE = 200;

export interface FileRangeCheck {
  /** Body to save, or null while a value cannot be sent (not an integer, note too long). */
  patch: FileRangePatch | null;
  /** Per-input messages shown under the fields. */
  errors: Partial<Record<keyof FileRangeDraft, string>>;
}

const AMOUNT_FORMAT = "0 이상의 정수를 입력하세요";
const RANGE_RULE = "검수 범위는 전체 분량 이내의 양의 정수";

function amount(value: string): number | null | undefined {
  const v = value.trim();
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n <= MAX_FILE_AMOUNT ? n : undefined;
}

/**
 * Validates attachment range inputs. Empty amounts are saved as null (not entered yet); the range
 * rule (1 ≤ review ≤ total) is shown at once but enforced on submit, like the server.
 */
export function parseFileRange(draft: FileRangeDraft): FileRangeCheck {
  const errors: FileRangeCheck["errors"] = {};
  const total = amount(draft.totalAmount);
  const review = amount(draft.reviewAmount);
  if (total === undefined) errors.totalAmount = AMOUNT_FORMAT;
  if (review === undefined) errors.reviewAmount = AMOUNT_FORMAT;
  const note = draft.rangeNote.trim();
  if (note.length > MAX_RANGE_NOTE) errors.rangeNote = `범위 설명은 최대 ${MAX_RANGE_NOTE}자입니다`;
  if (total === undefined || review === undefined || errors.rangeNote) return { patch: null, errors };
  if (total !== null && review !== null) {
    if (total < 1) errors.totalAmount = RANGE_RULE;
    else if (review < 1 || review > total) errors.reviewAmount = RANGE_RULE;
  }
  return { patch: { totalAmount: total, reviewAmount: review, rangeNote: note }, errors };
}

/** Inputs of a saved attachment (null amounts shown empty). */
export function readFileRange(file: Pick<FileMeta, "totalAmount" | "reviewAmount" | "rangeNote">): FileRangeDraft {
  return {
    totalAmount: file.totalAmount === null ? "" : String(file.totalAmount),
    reviewAmount: file.reviewAmount === null ? "" : String(file.reviewAmount),
    rangeNote: file.rangeNote ?? "",
  };
}
