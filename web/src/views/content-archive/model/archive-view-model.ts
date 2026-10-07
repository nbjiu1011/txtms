import {
  CONTENT_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  type ArchiveLine,
  type ArchiveListParams,
  type ContentType,
  type FinalStatus,
} from "@/entities/request";
import { formatDate } from "@/shared/lib";

/** Filter bar state (reference `tab.st.f = {q, type, camp, from, to, status}`). */
export interface ArchiveFilters {
  q: string;
  type: ContentType | "";
  campaign: string;
  status: FinalStatus | "";
  from: string;
  to: string;
}

export const EMPTY_ARCHIVE_FILTERS: ArchiveFilters = { q: "", type: "", campaign: "", status: "", from: "", to: "" };

/** Status filter choices: 검수 완료 / 승인 완료. */
export const ARCHIVE_STATUS_OPTIONS: readonly FinalStatus[] = ["REVIEW_COMPLETED", "APPROVED"];

/** Query of `GET /api/archive/contents` (blank filters are left out; the page is added by the list). */
export function archiveFiltersToParams(projectId: number, f: ArchiveFilters): Omit<ArchiveListParams, "page"> {
  const q = f.q.trim();
  return {
    projectId,
    ...(q ? { q } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.campaign ? { campaign: f.campaign } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.from ? { completedFrom: f.from } : {}),
    ...(f.to ? { completedTo: f.to } : {}),
  };
}

/** Number of linked entries shown when a line is expanded (past completions + open follow-ups). */
export function lineHistoryCount(line: Pick<ArchiveLine, "past" | "followUps">): number {
  return line.past.length + line.followUps.length;
}

/**
 * Label of the expand button: `이력` without linked entries; otherwise `이력 {n}` collapsed and `접기`
 * expanded (reference `lineToggle`).
 */
export function lineToggleLabel(line: Pick<ArchiveLine, "past" | "followUps">, open: boolean): string {
  const n = lineHistoryCount(line);
  if (n === 0) return "이력";
  return open ? "접기" : `이력 ${n}`;
}

/** Meta line under the title: `{요청 ID}  {유형}  {상태}  {완료일}  {캠페인?}`. */
export function lineMeta(latest: ArchiveLine["latest"]): string {
  return [
    latest.requestId,
    CONTENT_TYPE_LABEL[latest.type],
    REQUEST_STATUS_LABEL[latest.status],
    formatDate(latest.completedAt),
    latest.campaign ?? "",
  ]
    .filter(Boolean)
    .join("  ");
}

/** 복사 is offered only for text contents (no attachments). */
export function canCopyLine(line: ArchiveLine): boolean {
  return line.latest.fileNames.length === 0;
}
