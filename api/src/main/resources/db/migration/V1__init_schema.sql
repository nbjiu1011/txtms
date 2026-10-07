-- TX TMS schema (all milestones). Times are UTC DATETIME(6); dates (*_date) are KST calendar dates.
-- Enum values are stored as VARCHAR with the API contract names (UPPER_SNAKE_CASE).

-- ---------------------------------------------------------------- organization / accounts
CREATE TABLE customers (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    name                VARCHAR(100) NOT NULL,
    domain              VARCHAR(255) NOT NULL,
    approval_enabled    BOOLEAN      NOT NULL,
    active              BOOLEAN      NOT NULL DEFAULT 1,
    sample              BOOLEAN      NOT NULL DEFAULT 0,
    notify_channel      VARCHAR(20)  NOT NULL,
    due_soon_days       INT          NOT NULL DEFAULT 3,
    deactivation_reason VARCHAR(500) NULL,
    created_at          DATETIME(6)  NOT NULL,
    created_by          BIGINT       NULL,
    updated_at          DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_customers_domain (domain)
);

CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id   BIGINT       NULL,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    dept          VARCHAR(100) NULL,
    active        BOOLEAN      NOT NULL DEFAULT 1,
    pending       BOOLEAN      NOT NULL DEFAULT 0,
    operator      BOOLEAN      NOT NULL DEFAULT 0,
    demo          BOOLEAN      NOT NULL DEFAULT 0,
    avatar_color  CHAR(7)      NOT NULL,
    password_hash VARCHAR(100) NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_customer (customer_id),
    CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);

ALTER TABLE customers
    ADD CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users (id);

CREATE TABLE customer_admins (
    user_id     BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, customer_id),
    KEY idx_customer_admins_customer (customer_id),
    CONSTRAINT fk_customer_admins_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_customer_admins_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE user_sessions (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    refresh_token_hash CHAR(64)    NOT NULL,
    remember           BOOLEAN     NOT NULL,
    demo               BOOLEAN     NOT NULL DEFAULT 0,
    started_at         DATETIME(6) NOT NULL,
    last_seen_at       DATETIME(6) NOT NULL,
    expires_at         DATETIME(6) NOT NULL,
    revoked_at         DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_sessions_token (refresh_token_hash),
    KEY idx_user_sessions_user (user_id),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Consecutive login failures per normalized email (also for unknown emails, so locking never reveals accounts).
CREATE TABLE login_attempts (
    email          VARCHAR(255) NOT NULL,
    failed_count   INT          NOT NULL,
    last_failed_at DATETIME(6)  NOT NULL,
    locked_until   DATETIME(6)  NULL,
    PRIMARY KEY (email)
);

CREATE TABLE user_invitations (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at    DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    created_by BIGINT      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_invitations_token (token_hash),
    KEY idx_user_invitations_user (user_id),
    CONSTRAINT fk_user_invitations_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE password_resets (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at    DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_password_resets_token (token_hash),
    KEY idx_password_resets_user (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE outbound_emails (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id BIGINT       NULL,
    to_address  VARCHAR(255) NOT NULL,
    subject     VARCHAR(200) NOT NULL,
    body        TEXT         NOT NULL,
    status      VARCHAR(20)  NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    sent_at     DATETIME(6)  NULL,
    PRIMARY KEY (id),
    KEY idx_outbound_emails_customer (customer_id, created_at),
    CONSTRAINT fk_outbound_emails_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);

-- ---------------------------------------------------------------- projects / content types / variables
CREATE TABLE projects (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id        BIGINT       NOT NULL,
    name               VARCHAR(100) NOT NULL,
    active             BOOLEAN      NOT NULL DEFAULT 1,
    lead_user_id       BIGINT       NULL,
    variables_revision INT          NOT NULL DEFAULT 0,
    created_at         DATETIME(6)  NOT NULL,
    created_by         BIGINT       NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    KEY idx_projects_customer (customer_id),
    CONSTRAINT fk_projects_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_projects_lead FOREIGN KEY (lead_user_id) REFERENCES users (id)
);

-- Requester and reviewer are mutually exclusive per project (enforced in the service layer).
CREATE TABLE project_members (
    project_id BIGINT      NOT NULL,
    user_id    BIGINT      NOT NULL,
    role       VARCHAR(20) NOT NULL,
    PRIMARY KEY (project_id, user_id, role),
    KEY idx_project_members_user (user_id),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE project_templates (
    project_id BIGINT       NOT NULL,
    sort_order INT          NOT NULL,
    code       VARCHAR(50)  NOT NULL,
    name       VARCHAR(100) NOT NULL,
    PRIMARY KEY (project_id, sort_order),
    UNIQUE KEY uk_project_templates_code (project_id, code),
    CONSTRAINT fk_project_templates_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE project_senders (
    project_id    BIGINT      NOT NULL,
    sort_order    INT         NOT NULL,
    sender_number VARCHAR(20) NOT NULL,
    PRIMARY KEY (project_id, sort_order),
    UNIQUE KEY uk_project_senders_number (project_id, sender_number),
    CONSTRAINT fk_project_senders_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE content_types (
    type         VARCHAR(20) NOT NULL,
    active       BOOLEAN     NOT NULL DEFAULT 1,
    mock_enabled BOOLEAN     NOT NULL DEFAULT 0,
    sort_order   INT         NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    updated_by   BIGINT      NULL,
    PRIMARY KEY (type)
);

CREATE TABLE writing_guides (
    type             VARCHAR(20) NOT NULL,
    principles       TEXT        NOT NULL,
    good_expressions JSON        NOT NULL,
    checklist        JSON        NOT NULL,
    updated_at       DATETIME(6) NOT NULL,
    updated_by       BIGINT      NULL,
    PRIMARY KEY (type)
);

-- var_key uniqueness is case-insensitive through the utf8mb4_0900_ai_ci collation; deleted rows stay (key reuse forbidden).
CREATE TABLE variables (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    project_id  BIGINT       NOT NULL,
    var_key     VARCHAR(64)  NOT NULL,
    description VARCHAR(200) NULL,
    var_type    VARCHAR(10)  NOT NULL,
    value       TEXT         NULL,
    active      BOOLEAN      NOT NULL DEFAULT 1,
    deleted     BOOLEAN      NOT NULL DEFAULT 0,
    created_by  BIGINT       NULL,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_variables_key (project_id, var_key),
    CONSTRAINT fk_variables_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE variable_logs (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    variable_id BIGINT      NOT NULL,
    at          DATETIME(6) NOT NULL,
    actor_id    BIGINT      NULL,
    action      VARCHAR(30) NOT NULL,
    before_json JSON        NULL,
    after_json  JSON        NULL,
    PRIMARY KEY (id),
    KEY idx_variable_logs_variable (variable_id, at),
    CONSTRAINT fk_variable_logs_variable FOREIGN KEY (variable_id) REFERENCES variables (id)
);

-- ---------------------------------------------------------------- requests / contents
-- Single global counter (REQ-{YYMM KST}-{seq}); the counter does not reset monthly.
CREATE TABLE request_sequences (
    name       VARCHAR(20) NOT NULL,
    seq_value  INT         NOT NULL,
    PRIMARY KEY (name)
);

CREATE TABLE requests (
    id                  VARCHAR(20)  NOT NULL,
    project_id          BIGINT       NOT NULL,
    content_type        VARCHAR(20)  NOT NULL,
    title               VARCHAR(200) NOT NULL DEFAULT '',
    status              VARCHAR(20)  NOT NULL,
    round               INT          NOT NULL DEFAULT 1,
    round_bump          BOOLEAN      NOT NULL DEFAULT 0,
    answer_changed      BOOLEAN      NOT NULL DEFAULT 0,
    hope_due_date       DATE         NULL,
    due_date            DATE         NULL,
    urgency             VARCHAR(10)  NOT NULL DEFAULT 'NORMAL',
    purpose             TEXT         NULL,
    target              TEXT         NULL,
    background          TEXT         NULL,
    campaign            VARCHAR(200) NULL,
    requested_by        BIGINT       NOT NULL,
    created_at          DATETIME(6)  NOT NULL,
    submitted_at        DATETIME(6)  NULL,
    completed_at        DATETIME(6)  NULL,
    primary_reviewer_id BIGINT       NULL,
    recall_requested_by BIGINT       NULL,
    recall_requested_at DATETIME(6)  NULL,
    recall_reason       TEXT         NULL,
    cancelled           BOOLEAN      NOT NULL DEFAULT 0,
    demo                BOOLEAN      NOT NULL DEFAULT 0,
    parent_request_id   VARCHAR(20)  NULL,
    parent_content_key  VARCHAR(10)  NULL,
    row_version         BIGINT       NOT NULL DEFAULT 0,
    updated_at          DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    KEY idx_requests_project_status (project_id, status),
    KEY idx_requests_requested_by (requested_by),
    KEY idx_requests_primary (primary_reviewer_id),
    KEY idx_requests_parent (parent_request_id),
    CONSTRAINT fk_requests_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
    CONSTRAINT fk_requests_primary FOREIGN KEY (primary_reviewer_id) REFERENCES users (id),
    CONSTRAINT fk_requests_recall_by FOREIGN KEY (recall_requested_by) REFERENCES users (id),
    CONSTRAINT fk_requests_parent FOREIGN KEY (parent_request_id) REFERENCES requests (id)
);

CREATE TABLE request_reviewers (
    request_id VARCHAR(20) NOT NULL,
    sort_order INT         NOT NULL,
    user_id    BIGINT      NOT NULL,
    PRIMARY KEY (request_id, sort_order),
    UNIQUE KEY uk_request_reviewers_user (request_id, user_id),
    KEY idx_request_reviewers_user (user_id),
    CONSTRAINT fk_request_reviewers_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_request_reviewers_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE request_assignment_changes (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    request_id        VARCHAR(20) NOT NULL,
    at                DATETIME(6) NOT NULL,
    actor_id          BIGINT      NOT NULL,
    round             INT         NOT NULL,
    from_reviewer_ids JSON        NOT NULL,
    from_primary_id   BIGINT      NULL,
    to_reviewer_ids   JSON        NOT NULL,
    to_primary_id     BIGINT      NULL,
    reason            TEXT        NULL,
    handover          TEXT        NULL,
    PRIMARY KEY (id),
    KEY idx_request_assignment_changes_request (request_id, at),
    CONSTRAINT fk_request_assignment_changes_request FOREIGN KEY (request_id) REFERENCES requests (id)
);

CREATE TABLE request_reminders (
    request_id        VARCHAR(20) NOT NULL,
    user_id           BIGINT      NOT NULL,
    count             INT         NOT NULL,
    last_at           DATETIME(6) NOT NULL,
    due_date_snapshot DATE        NULL,
    PRIMARY KEY (request_id, user_id),
    CONSTRAINT fk_request_reminders_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_request_reminders_user FOREIGN KEY (user_id) REFERENCES users (id)
);

-- payload: type-specific ContentPayload JSON (contract keys). Deleted rows are kept so content keys are never reused.
CREATE TABLE contents (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    request_id         VARCHAR(20)  NOT NULL,
    content_key        VARCHAR(10)  NOT NULL,
    title              VARCHAR(200) NOT NULL DEFAULT '',
    payload            JSON         NOT NULL,
    version            INT          NOT NULL DEFAULT 1,
    lock_user_id       BIGINT       NULL,
    lock_at            DATETIME(6)  NULL,
    saved_at           DATETIME(6)  NULL,
    sort_order         INT          NOT NULL,
    deleted            BOOLEAN      NOT NULL DEFAULT 0,
    parent_request_id  VARCHAR(20)  NULL,
    parent_content_key VARCHAR(10)  NULL,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_contents_key (request_id, content_key),
    KEY idx_contents_lock_user (lock_user_id),
    KEY idx_contents_parent (parent_request_id, parent_content_key),
    CONSTRAINT fk_contents_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_contents_lock_user FOREIGN KEY (lock_user_id) REFERENCES users (id)
);

CREATE TABLE content_versions (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    content_id     BIGINT       NOT NULL,
    version        INT          NOT NULL,
    title          VARCHAR(200) NOT NULL DEFAULT '',
    payload        JSON         NOT NULL,
    files_snapshot JSON         NOT NULL,
    created_at     DATETIME(6)  NOT NULL,
    created_by     BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_content_versions (content_id, version),
    CONSTRAINT fk_content_versions_content FOREIGN KEY (content_id) REFERENCES contents (id)
);

CREATE TABLE content_files (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    content_id      BIGINT       NOT NULL,
    name            VARCHAR(255) NOT NULL,
    ext             VARCHAR(10)  NOT NULL,
    unit            VARCHAR(10)  NOT NULL,
    size_bytes      BIGINT       NOT NULL,
    total_amount    INT          NULL,
    review_amount   INT          NULL,
    range_note      VARCHAR(200) NULL,
    current_version INT          NOT NULL DEFAULT 1,
    sort_order      INT          NOT NULL,
    deleted         BOOLEAN      NOT NULL DEFAULT 0,
    created_at      DATETIME(6)  NOT NULL,
    created_by      BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_content_files_content (content_id),
    CONSTRAINT fk_content_files_content FOREIGN KEY (content_id) REFERENCES contents (id)
);

CREATE TABLE content_file_versions (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    file_id     BIGINT       NOT NULL,
    version     INT          NOT NULL,
    name        VARCHAR(255) NOT NULL,
    size_bytes  BIGINT       NOT NULL,
    storage_key VARCHAR(255) NULL,
    scan_status VARCHAR(10)  NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    created_by  BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_content_file_versions (file_id, version),
    CONSTRAINT fk_content_file_versions_file FOREIGN KEY (file_id) REFERENCES content_files (id)
);

CREATE TABLE content_images (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    request_id   VARCHAR(20)  NOT NULL,
    content_id   BIGINT       NOT NULL,
    image_key    VARCHAR(40)  NOT NULL,
    storage_key  VARCHAR(255) NOT NULL,
    mime_type    VARCHAR(50)  NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    created_at   DATETIME(6)  NOT NULL,
    created_by   BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_content_images_key (image_key),
    KEY idx_content_images_request (request_id),
    CONSTRAINT fk_content_images_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_content_images_content FOREIGN KEY (content_id) REFERENCES contents (id)
);

-- ---------------------------------------------------------------- collaboration / history / completion
CREATE TABLE request_opinions (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    request_id  VARCHAR(20) NOT NULL,
    content_key VARCHAR(10) NULL,
    author_id   BIGINT      NOT NULL,
    body        TEXT        NOT NULL,
    round       INT         NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_request_opinions_request (request_id, created_at),
    CONSTRAINT fk_request_opinions_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_request_opinions_author FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE TABLE request_asks (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    request_id  VARCHAR(20) NOT NULL,
    content_key VARCHAR(10) NULL,
    asked_by    BIGINT      NOT NULL,
    question    TEXT        NOT NULL,
    asked_at    DATETIME(6) NOT NULL,
    answer      TEXT        NULL,
    answered_by BIGINT      NULL,
    answered_at DATETIME(6) NULL,
    round       INT         NOT NULL,
    PRIMARY KEY (id),
    KEY idx_request_asks_request (request_id, asked_at),
    CONSTRAINT fk_request_asks_request FOREIGN KEY (request_id) REFERENCES requests (id),
    CONSTRAINT fk_request_asks_asked_by FOREIGN KEY (asked_by) REFERENCES users (id)
);

-- Append-only business history. content_key NULL = whole request.
CREATE TABLE request_history (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    request_id    VARCHAR(20)  NOT NULL,
    at            DATETIME(6)  NOT NULL,
    actor_id      BIGINT       NULL,
    action        VARCHAR(50)  NOT NULL,
    detail        TEXT         NULL,
    content_key   VARCHAR(10)  NULL,
    content_title VARCHAR(200) NULL,
    round         INT          NOT NULL,
    PRIMARY KEY (id),
    KEY idx_request_history_request (request_id, at),
    KEY idx_request_history_actor (actor_id, action),
    CONSTRAINT fk_request_history_request FOREIGN KEY (request_id) REFERENCES requests (id)
);

CREATE TABLE completion_bundles (
    request_id         VARCHAR(20) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    completed_at       DATETIME(6) NOT NULL,
    completed_by       BIGINT      NOT NULL,
    variables_snapshot JSON        NOT NULL,
    PRIMARY KEY (request_id),
    CONSTRAINT fk_completion_bundles_request FOREIGN KEY (request_id) REFERENCES requests (id)
);

CREATE TABLE completion_bundle_items (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    request_id     VARCHAR(20)  NOT NULL,
    content_key    VARCHAR(10)  NOT NULL,
    title          VARCHAR(200) NOT NULL DEFAULT '',
    version        INT          NOT NULL,
    payload        JSON         NOT NULL,
    files_snapshot JSON         NOT NULL,
    sort_order     INT          NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_completion_bundle_items (request_id, content_key),
    CONSTRAINT fk_completion_bundle_items_bundle FOREIGN KEY (request_id) REFERENCES completion_bundles (request_id)
);

-- ---------------------------------------------------------------- notifications / notices
CREATE TABLE notifications (
    id                     BIGINT       NOT NULL AUTO_INCREMENT,
    user_id                BIGINT       NOT NULL,
    kind                   VARCHAR(20)  NOT NULL,
    request_id             VARCHAR(20)  NULL,
    text                   VARCHAR(500) NOT NULL,
    created_at             DATETIME(6)  NOT NULL,
    read_at                DATETIME(6)  NULL,
    renotify               BOOLEAN      NOT NULL DEFAULT 0,
    actor_id               BIGINT       NULL,
    source_notification_id BIGINT       NULL,
    PRIMARY KEY (id),
    KEY idx_notifications_user (user_id, created_at),
    KEY idx_notifications_request (request_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_notifications_request FOREIGN KEY (request_id) REFERENCES requests (id)
);

CREATE TABLE notices (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    scope        VARCHAR(20)  NOT NULL,
    customer_id  BIGINT       NOT NULL,
    project_id   BIGINT       NULL,
    title        VARCHAR(200) NOT NULL,
    body         TEXT         NOT NULL,
    author_id    BIGINT       NOT NULL,
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    edited       BOOLEAN      NOT NULL DEFAULT 0,
    withdrawn    BOOLEAN      NOT NULL DEFAULT 0,
    withdrawn_at DATETIME(6)  NULL,
    PRIMARY KEY (id),
    KEY idx_notices_customer (customer_id, created_at),
    KEY idx_notices_project (project_id),
    CONSTRAINT fk_notices_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_notices_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- Full snapshot of the notice before each change, with the actor.
CREATE TABLE notice_logs (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    notice_id           BIGINT       NOT NULL,
    at                  DATETIME(6)  NOT NULL,
    actor_id            BIGINT       NOT NULL,
    action              VARCHAR(20)  NOT NULL,
    previous_scope      VARCHAR(20)  NOT NULL,
    previous_project_id BIGINT       NULL,
    previous_title      VARCHAR(200) NOT NULL,
    previous_body       TEXT         NOT NULL,
    PRIMARY KEY (id),
    KEY idx_notice_logs_notice (notice_id, at),
    CONSTRAINT fk_notice_logs_notice FOREIGN KEY (notice_id) REFERENCES notices (id)
);

-- ---------------------------------------------------------------- text correction
CREATE TABLE datasets (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    scope      VARCHAR(20) NOT NULL,
    version    INT         NOT NULL,
    created_at DATETIME(6) NOT NULL,
    created_by BIGINT      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_datasets_scope_version (scope, version)
);

-- Seven engine columns of the correction engine specification.
CREATE TABLE dataset_rules (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    dataset_id          BIGINT       NOT NULL,
    sort_order          INT          NOT NULL,
    rule_id             VARCHAR(50)  NOT NULL,
    original_expr       VARCHAR(500) NULL,
    recommended_expr    VARCHAR(500) NULL,
    original_pattern    VARCHAR(500) NULL,
    recommended_pattern VARCHAR(500) NULL,
    description_label   VARCHAR(100) NULL,
    description         TEXT         NULL,
    PRIMARY KEY (id),
    KEY idx_dataset_rules_dataset (dataset_id, sort_order),
    CONSTRAINT fk_dataset_rules_dataset FOREIGN KEY (dataset_id) REFERENCES datasets (id)
);

CREATE TABLE dataset_assignments (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    customer_id BIGINT      NOT NULL,
    type        VARCHAR(20) NOT NULL,
    dataset_id  BIGINT      NOT NULL,
    assigned_at DATETIME(6) NOT NULL,
    assigned_by BIGINT      NULL,
    checked_at  DATETIME(6) NULL,
    checked_by  BIGINT      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_dataset_assignments (customer_id, type),
    CONSTRAINT fk_dataset_assignments_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_dataset_assignments_dataset FOREIGN KEY (dataset_id) REFERENCES datasets (id)
);

CREATE TABLE correction_suggestions (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    request_id   VARCHAR(20) NOT NULL,
    content_key  VARCHAR(10) NOT NULL,
    matched_text TEXT        NOT NULL,
    rule_ids     JSON        NOT NULL,
    body         TEXT        NOT NULL,
    created_by   BIGINT      NOT NULL,
    created_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_correction_suggestions_request (request_id),
    CONSTRAINT fk_correction_suggestions_request FOREIGN KEY (request_id) REFERENCES requests (id)
);

-- ---------------------------------------------------------------- operations / audit
-- retention_until is set only for access/export records; NULL = kept forever.
CREATE TABLE audit_logs (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    at              DATETIME(6)  NOT NULL,
    actor_id        BIGINT       NULL,
    customer_id     BIGINT       NULL,
    action          VARCHAR(50)  NOT NULL,
    target          VARCHAR(200) NULL,
    detail          TEXT         NULL,
    retention_until DATETIME(6)  NULL,
    PRIMARY KEY (id),
    KEY idx_audit_logs_customer (customer_id, at),
    KEY idx_audit_logs_retention (retention_until)
);

CREATE TABLE setup_logs (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    customer_id BIGINT       NOT NULL,
    at          DATETIME(6)  NOT NULL,
    actor_id    BIGINT       NULL,
    action      VARCHAR(50)  NOT NULL,
    target      VARCHAR(200) NULL,
    result      VARCHAR(300) NULL,
    PRIMARY KEY (id),
    KEY idx_setup_logs_customer (customer_id, at),
    CONSTRAINT fk_setup_logs_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);
