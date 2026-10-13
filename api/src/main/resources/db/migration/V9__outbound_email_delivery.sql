-- SMTP delivery of the outbox (contract §23). A mail is sent by a batch job; failed attempts are retried with a
-- growing delay until the attempt limit, then the mail is FAILED. The last error stays here for the server log only.
ALTER TABLE outbound_emails
    ADD COLUMN attempts        INT          NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN next_attempt_at DATETIME(6)  NULL AFTER attempts,
    ADD COLUMN last_error      VARCHAR(500) NULL AFTER next_attempt_at;

-- Mails queued before delivery existed were never meant to be sent (their links were handed over from the outbox
-- by hand, and on the demo server they are addressed to seeded accounts). Keep them, but never deliver them.
UPDATE outbound_emails SET status = 'SKIPPED' WHERE status = 'PENDING';

CREATE INDEX idx_outbound_emails_due ON outbound_emails (status, next_attempt_at);
