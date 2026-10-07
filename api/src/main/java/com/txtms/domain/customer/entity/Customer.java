package com.txtms.domain.customer.entity;

import java.time.Instant;

import com.txtms.global.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Top-level tenant. {@code approvalEnabled} is fixed at creation. */
@Entity
@Table(name = "customers")
public class Customer extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private String domain;

    @Column(name = "approval_enabled", nullable = false, updatable = false)
    private boolean approvalEnabled;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean sample;

    @Enumerated(EnumType.STRING)
    @Column(name = "notify_channel", nullable = false, length = 20)
    private NotifyChannel notifyChannel;

    @Column(name = "due_soon_days", nullable = false)
    private int dueSoonDays;

    @Column(name = "deactivation_reason", length = 500)
    private String deactivationReason;

    @Column(name = "created_by")
    private Long createdBy;

    protected Customer() {
    }

    public Customer(String name, String domain, boolean approvalEnabled, boolean sample, NotifyChannel notifyChannel,
            int dueSoonDays, Long createdBy, Instant now) {
        this.name = name;
        this.domain = domain.toLowerCase();
        this.approvalEnabled = approvalEnabled;
        this.active = true;
        this.sample = sample;
        this.notifyChannel = notifyChannel;
        this.dueSoonDays = dueSoonDays;
        this.createdBy = createdBy;
        initTimestamps(now);
    }

    /** Seeding only: back-dates creation to the demo timeline. */
    public void backdate(Instant createdAt, Long createdBy) {
        initTimestamps(createdAt);
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDomain() {
        return domain;
    }

    public boolean isApprovalEnabled() {
        return approvalEnabled;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isSample() {
        return sample;
    }

    public NotifyChannel getNotifyChannel() {
        return notifyChannel;
    }

    public int getDueSoonDays() {
        return dueSoonDays;
    }

    public String getDeactivationReason() {
        return deactivationReason;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
