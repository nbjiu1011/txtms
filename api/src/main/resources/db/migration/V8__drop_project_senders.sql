-- The service never sends messages, so projects no longer register SMS sender numbers and contents are not checked
-- against such a list (client decision 2026-10-13). The SMS 발신자 stays an optional free-text field of a content.
DROP TABLE project_senders;

-- The SMS writing guide seeded by V5 mentioned the removed registry. Only the exact seeded wording is removed, so a
-- guide an operator has already rewritten is left as it is.
UPDATE writing_guides
SET principles = REPLACE(principles, ' 발신번호는 등록된 번호만 사용합니다.', ''),
    checklist  = REPLACE(checklist, '"발신번호 등록 여부",', '')
WHERE type = 'SMS';
