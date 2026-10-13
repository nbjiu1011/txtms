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

export const OUTBOX_MAIL_KINDS = ["INVITATION", "PASSWORD_RESET", "EMAIL_CHANGE", "REMINDER", "OTHER"] as const;
export type OutboxMailKind = (typeof OUTBOX_MAIL_KINDS)[number];

export const OUTBOX_KIND_LABEL: Record<OutboxMailKind, string> = {
  INVITATION: "초대",
  PASSWORD_RESET: "비밀번호 재설정",
  EMAIL_CHANGE: "이메일 변경 확인",
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
  /** Delivery status (contract §23): PENDING · SENT · FAILED · SKIPPED. */
  status: string;
  /** When the SMTP server accepted the mail; null otherwise. */
  sentAt: string | null;
  /** Token links in the body were replaced (`…/invite/••••`); only the recipient gets the link. */
  masked: boolean;
  /** What the mail is for (contract §14.6). */
  kind: OutboxMailKind;
}

/** Delivery status label of an outbox mail (contract §23). */
export const OUTBOX_STATUS_LABEL: Record<string, string> = {
  PENDING: "발송 대기",
  SENT: "발송 완료",
  FAILED: "발송 실패",
  SKIPPED: "발송 안 함",
};
