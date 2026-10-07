/** Audit trail and mail outbox — contract §11, §12. */
export interface AuditLog {
  id: number;
  at: string;
  actorId: number;
  action: string;
  customerId: number | null;
  target: string;
  detail: string;
}

export interface OutboxMail {
  id: number;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  status: string;
}
