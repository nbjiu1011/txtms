-- M1 request authoring.
-- Idempotency key of the last successful submit: a repeated submit with the same key returns the current state
-- instead of failing or creating another round.
ALTER TABLE requests
    ADD COLUMN submit_idempotency_key VARCHAR(64) NULL AFTER row_version;
