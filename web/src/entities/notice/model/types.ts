/** Notices — contract §0.5, §10. */
export const NOTICE_SCOPES = ["CUSTOMER", "PROJECT"] as const;
export type NoticeScope = (typeof NOTICE_SCOPES)[number];

export const NOTICE_SCOPE_LABEL: Record<NoticeScope, string> = {
  CUSTOMER: "고객사 전체",
  PROJECT: "프로젝트",
};

/** `수정` / `철회` entry with the snapshot before the change. */
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
  edited: boolean;
  withdrawn: boolean;
  logs: NoticeLog[];
}

/**
 * Dashboard notice item (contract §9 `NoticeSummary`): a subset of Notice.
 */
export type NoticeSummary = Pick<Notice, "id" | "scope" | "customerId" | "projectId" | "title" | "createdAt">;

export interface NoticeUpsert {
  scope: NoticeScope;
  projectId: number | null;
  title: string;
  body: string;
}
