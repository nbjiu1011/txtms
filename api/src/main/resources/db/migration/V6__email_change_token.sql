-- Email change with a confirmation link: an accepted user's new address takes effect only after the link mailed to
-- that address is opened (single use, 24 hours). Same shape as the other account tokens plus the new address.
CREATE TABLE email_changes (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    user_id    BIGINT       NOT NULL,
    token_hash CHAR(64)     NOT NULL,
    new_email  VARCHAR(255) NOT NULL,
    expires_at DATETIME(6)  NOT NULL,
    used_at    DATETIME(6)  NULL,
    revoked_at DATETIME(6)  NULL,
    created_at DATETIME(6)  NOT NULL,
    created_by BIGINT       NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_email_changes_token (token_hash),
    KEY idx_email_changes_user (user_id),
    CONSTRAINT fk_email_changes_user FOREIGN KEY (user_id) REFERENCES users (id)
);
