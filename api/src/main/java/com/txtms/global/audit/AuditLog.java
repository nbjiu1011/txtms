package com.txtms.global.audit;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Append-only audit record. */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant at;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(length = 200)
    private String target;

    @Column(columnDefinition = "text")
    private String detail;

    @Column(name = "retention_until")
    private Instant retentionUntil;

    protected AuditLog() {
    }

    AuditLog(Instant at, Long actorId, Long customerId, String action, String target, String detail,
            Instant retentionUntil) {
        this.at = at;
        this.actorId = actorId;
        this.customerId = customerId;
        this.action = action;
        this.target = target;
        this.detail = detail;
        this.retentionUntil = retentionUntil;
    }

    public Long getId() {
        return id;
    }

    public Instant getAt() {
        return at;
    }

    public Long getActorId() {
        return actorId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getAction() {
        return action;
    }

    public String getTarget() {
        return target;
    }

    public String getDetail() {
        return detail;
    }

    public Instant getRetentionUntil() {
        return retentionUntil;
    }
}
