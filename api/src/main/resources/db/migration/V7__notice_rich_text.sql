-- Notice bodies become sanitized HTML from the rich text editor, possibly with small inline images (contract §18):
-- TEXT (64 KiB) is too small, MEDIUMTEXT holds 16 MiB. Existing plain-text bodies are kept as they are.
ALTER TABLE notices MODIFY body MEDIUMTEXT NOT NULL;
ALTER TABLE notice_logs MODIFY previous_body MEDIUMTEXT NOT NULL;
