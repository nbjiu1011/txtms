-- Mails are rendered from templates (contract §23) as HTML plus a plain-text alternative. The outbox listing keeps
-- showing the plain text (`body`); the HTML part is only used for delivery. Mails queued before this are text only.
ALTER TABLE outbound_emails
    ADD COLUMN html_body TEXT NULL AFTER body;
