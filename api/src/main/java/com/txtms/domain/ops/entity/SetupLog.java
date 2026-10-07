package com.txtms.domain.ops.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Append-only record of an operator's initial-setup step for a customer ({@code 시드 실행 이력}). */
@Entity
@Table(name = "setup_logs")
public class SetupLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private Long customerId;

    @Column(nullable = false, updatable = false)
    private Instant at;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(nullable = false, length = 50, updatable = false)
    private String action;

    @Column(length = 200, updatable = false)
    private String target;

    @Column(length = 300, updatable = false)
    private String result;

    protected SetupLog() {
    }

    public SetupLog(Long customerId, Instant at, Long actorId, String action, String target, String result) {
        this.customerId = customerId;
        this.at = at;
        this.actorId = actorId;
        this.action = action;
        this.target = target == null || target.length() <= 200 ? target : target.substring(0, 200);
        this.result = result == null || result.length() <= 300 ? result : result.substring(0, 300);
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public Instant getAt() {
        return at;
    }

    public Long getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public String getTarget() {
        return target;
    }

    public String getResult() {
        return result;
    }
}
