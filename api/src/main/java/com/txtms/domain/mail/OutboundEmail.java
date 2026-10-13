package com.txtms.domain.mail;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Mail in the outbox (contract §23). Status transitions: created {@code PENDING} (delivered by the dispatch job) or
 * {@code SKIPPED} (not deliverable); {@code PENDING} → {@code SENT}, or after the last failed attempt {@code FAILED}.
 * {@code SENT}, {@code FAILED} and {@code SKIPPED} are final.
 */
@Entity
@Table(name = "outbound_emails")
public class OutboundEmail {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_SKIPPED = "SKIPPED";

    private static final int MAX_ERROR_LENGTH = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", updatable = false)
    private Long customerId;

    @Column(name = "to_address", nullable = false, updatable = false)
    private String to;

    @Column(nullable = false, updatable = false, length = 200)
    private String subject;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String body;

    /** HTML part used for delivery only (null for mails queued before templates, V11). */
    @Column(name = "html_body", updatable = false, columnDefinition = "text")
    private String htmlBody;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private MailKind kind;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "last_error", length = MAX_ERROR_LENGTH)
    private String lastError;

    protected OutboundEmail() {
    }

    /**
     * A new mail: {@code deliverable} mails wait for the dispatch job ({@code PENDING}, due now), the others are kept
     * as {@code SKIPPED}.
     */
    public OutboundEmail(MailKind kind, Long customerId, String to, String subject, String body, Instant now,
            boolean deliverable) {
        this(kind, customerId, to, new MailContent(subject, body, null), now, deliverable);
    }

    /** A mail rendered from a template: the text part is the listed body, the HTML part is sent alongside it. */
    public OutboundEmail(MailKind kind, Long customerId, String to, MailContent content, Instant now,
            boolean deliverable) {
        this.kind = kind == null ? MailKind.OTHER : kind;
        this.customerId = customerId;
        this.to = to;
        this.subject = content.subject();
        this.body = content.text();
        this.htmlBody = content.html();
        this.status = deliverable ? STATUS_PENDING : STATUS_SKIPPED;
        this.nextAttemptAt = deliverable ? now : null;
        this.createdAt = now;
    }

    /** The SMTP server accepted the mail. */
    public void markSent(Instant now) {
        requirePending();
        this.status = STATUS_SENT;
        this.sentAt = now;
        this.attempts++;
        this.nextAttemptAt = null;
        this.lastError = null;
    }

    /**
     * A delivery attempt failed: retry after the next delay of {@code retryDelays}, or {@code FAILED} when this was
     * the last allowed attempt.
     */
    public void recordFailure(String error, Instant now, List<Duration> retryDelays) {
        requirePending();
        this.attempts++;
        this.lastError = error == null ? null : error.length() > MAX_ERROR_LENGTH ? error.substring(0, MAX_ERROR_LENGTH) : error;
        if (attempts > retryDelays.size()) {
            this.status = STATUS_FAILED;
            this.nextAttemptAt = null;
        } else {
            this.nextAttemptAt = now.plus(retryDelays.get(attempts - 1));
        }
    }

    /** Not deliverable any more (the recipient rule changed since it was queued); kept, never sent. */
    public void markSkipped() {
        requirePending();
        this.status = STATUS_SKIPPED;
        this.nextAttemptAt = null;
    }

    private void requirePending() {
        if (!STATUS_PENDING.equals(status)) {
            throw new IllegalStateException("Mail " + id + " is " + status + ", not " + STATUS_PENDING);
        }
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getTo() {
        return to;
    }

    public String getSubject() {
        return subject;
    }

    public String getBody() {
        return body;
    }

    public String getHtmlBody() {
        return htmlBody;
    }

    public MailKind getKind() {
        return kind;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public int getAttempts() {
        return attempts;
    }

    public Instant getNextAttemptAt() {
        return nextAttemptAt;
    }

    public String getLastError() {
        return lastError;
    }
}
