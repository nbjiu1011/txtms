-- What an outbox mail is for (INVITATION, PASSWORD_RESET, REMINDER, OTHER). New mails get it from the sender;
-- mails queued before this column existed are classified by their subject.
ALTER TABLE outbound_emails
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'OTHER' AFTER body;

UPDATE outbound_emails
SET kind = CASE
        WHEN subject = 'TX TMS 초대' THEN 'INVITATION'
        WHEN subject = 'TX TMS 비밀번호 재설정' THEN 'PASSWORD_RESET'
        WHEN subject LIKE '미처리 재통지 %' OR subject LIKE '납기 임박 재통지 %' THEN 'REMINDER'
        ELSE 'OTHER'
    END
WHERE kind = 'OTHER';
