-- Notices can be saved unpublished, published and unpublished again, and soft-deleted and restored (contract §22).
-- This replaces the irreversible withdrawal: withdrawn notices become unpublished (not deleted), their 철회 logs stay.
ALTER TABLE notices
    ADD COLUMN published    BOOLEAN     NOT NULL DEFAULT 1 AFTER edited,
    ADD COLUMN published_at DATETIME(6) NULL AFTER published,
    ADD COLUMN deleted      BOOLEAN     NOT NULL DEFAULT 0 AFTER published_at,
    ADD COLUMN deleted_at   DATETIME(6) NULL AFTER deleted;

UPDATE notices SET published = NOT withdrawn, published_at = created_at;

ALTER TABLE notices
    DROP COLUMN withdrawn,
    DROP COLUMN withdrawn_at,
    ADD KEY idx_notices_visible (customer_id, deleted, published, published_at);
