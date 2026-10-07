/** Audit trail and mail outbox — contract §11, §12. */
export interface AuditLog {
  id: number;
  at: string;
  actorId: number | null;
  /** Current name of the actor (null for system actions). */
  actorName: string | null;
  action: string;
  customerId: number | null;
  target: string;
  detail: string;
}

export const OUTBOX_MAIL_KINDS = ["INVITATION", "PASSWORD_RESET", "REMINDER", "OTHER"] as const;
export type OutboxMailKind = (typeof OUTBOX_MAIL_KINDS)[number];

export const OUTBOX_KIND_LABEL: Record<OutboxMailKind, string> = {
  INVITATION: "초대",
  PASSWORD_RESET: "비밀번호 재설정",
  REMINDER: "재통지",
  OTHER: "기타",
};

export interface OutboxMail {
  id: number;
  customerId: number | null;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  status: string;
  /** Token links in the body were replaced (`…/invite/••••`); only the recipient gets the link. */
  masked: boolean;
  /** What the mail is for (contract §14.6). */
  kind: OutboxMailKind;
}

/** Status label of a queued mail (no real delivery yet). */
export const OUTBOX_STATUS_LABEL: Record<string, string> = {
  PENDING: "발송 대기",
};
