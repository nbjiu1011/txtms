import { type StatusTone, type TypeTone } from "@/shared/ui";
import type { ContentType, FileScanStatus, FileUnit, RequestStatus, Urgency } from "./types";

/** Screen labels of `RequestStatus` (contract §0.5). */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "작성 중",
  WAITING: "배정 대기",
  IN_REVIEW: "검수 중",
  CONFIRMING: "확인 요청",
  APPROVAL_WAITING: "승인 대기",
  REVIEW_COMPLETED: "검수 완료",
  APPROVED: "승인 완료",
};

/** Status → prototype tone (`--s-*`). 승인 완료 shares the done tone. */
export const REQUEST_STATUS_TONE: Record<RequestStatus, StatusTone> = {
  DRAFT: "draft",
  WAITING: "wait",
  IN_REVIEW: "review",
  CONFIRMING: "ask",
  APPROVAL_WAITING: "appr",
  REVIEW_COMPLETED: "done",
  APPROVED: "done",
};

/** CSS color token of a status tone, for components that take a color (track, KPI). */
export const STATUS_TONE_COLOR: Record<StatusTone, string> = {
  draft: "var(--s-draft)",
  wait: "var(--s-wait)",
  review: "var(--s-review)",
  ask: "var(--s-ask)",
  appr: "var(--s-appr)",
  done: "var(--s-done)",
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  ALIMTALK: "알림톡",
  SMS: "문자",
  RCS: "RCS",
  FREEFORM: "자유입력형",
};

/** Content type → `--ty-*` tone and glyph. */
export const CONTENT_TYPE_TONE: Record<ContentType, TypeTone> = {
  ALIMTALK: "a",
  SMS: "s",
  RCS: "r",
  FREEFORM: "f",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  NORMAL: "보통",
  URGENT: "긴급",
};

export const FILE_UNIT_LABEL: Record<FileUnit, string> = {
  PAGE: "페이지",
  ROW: "행",
  SLIDE: "슬라이드",
  LINE: "줄",
  IMAGE: "장",
};

export const FILE_SCAN_STATUS_LABEL: Record<FileScanStatus, string> = {
  PENDING: "검사 중",
  SAFE: "정상",
  FAILED: "검사 실패",
  UNSAFE: "위험 차단",
};
