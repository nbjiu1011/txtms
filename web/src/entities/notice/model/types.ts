/** Notices — contract §0.5, §10. */
export const NOTICE_SCOPES = ["CUSTOMER", "PROJECT"] as const;
export type NoticeScope = (typeof NOTICE_SCOPES)[number];

export const NOTICE_SCOPE_LABEL: Record<NoticeScope, string> = {
  CUSTOMER: "고객사 전체",
  PROJECT: "프로젝트",
};

/** `수정` / `게시` / `게시 중지` / `삭제` / `복원` (older `철회`) entry with the snapshot before the change. */
export interface NoticeLog {
  at: string;
  actorId: number;
  action: string;
  previousScope: NoticeScope | null;
  previousProjectId: number | null;
  previousTitle: string | null;
  previousBody: string | null;
}

export interface Notice {
  id: number;
  scope: NoticeScope;
  customerId: number;
  projectId: number | null;
  title: string;
  body: string;
  authorId: number;
  createdAt: string;
  /** Last time it was published (kept while unpublished); null if never published. */
  publishedAt: string | null;
  edited: boolean;
  /** Shown to users (contract §22). */
  published: boolean;
  /** Soft-deleted: only in the admin's deleted list until restored. */
  deleted: boolean;
  logs: NoticeLog[];
}

/**
 * Dashboard notice item (contract §9 `NoticeSummary`): a subset of Notice.
 */
export type NoticeSummary = Pick<
  Notice,
  "id" | "scope" | "customerId" | "projectId" | "title" | "createdAt" | "publishedAt"
>;

export interface NoticeUpsert {
  scope: NoticeScope;
  projectId: number | null;
  title: string;
  body: string;
  /** Create only (omitted = published); edits keep the publish state. */
  published?: boolean;
}

export type NoticeState = "PUBLISHED" | "UNPUBLISHED" | "DELETED";

export const NOTICE_STATE_LABEL: Record<NoticeState, string> = {
  PUBLISHED: "게시",
  UNPUBLISHED: "미게시",
  DELETED: "삭제",
};

export function noticeState(notice: Pick<Notice, "published" | "deleted">): NoticeState {
  if (notice.deleted) return "DELETED";
  return notice.published ? "PUBLISHED" : "UNPUBLISHED";
}

/** Time shown to users: when it was (last) published. */
export function noticePostedAt(notice: Pick<Notice, "publishedAt" | "createdAt">): string {
  return notice.publishedAt ?? notice.createdAt;
}
