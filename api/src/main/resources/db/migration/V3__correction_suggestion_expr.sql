-- Contract §14.4: the "건의하기" suggestion may carry the expression the user proposes (optional, at most 200 chars).
ALTER TABLE correction_suggestions
    ADD COLUMN suggested_expr VARCHAR(200) NULL AFTER matched_text;
