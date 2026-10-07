package com.txtms.domain.variable.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Append-only change log of a variable: {@code before}/{@code after} are {@code {key, type, value, active}}. */
@Entity
@Table(name = "variable_logs")
public class VariableLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "variable_id", nullable = false, updatable = false)
    private Long variableId;

    @Column(nullable = false, updatable = false)
    private Instant at;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false, length = 30)
    private String action;

    @Column(name = "before_json", updatable = false, columnDefinition = "json")
    private String before;

    @Column(name = "after_json", updatable = false, columnDefinition = "json")
    private String after;

    protected VariableLog() {
    }

    public VariableLog(Long variableId, Instant at, Long actorId, String action, String before, String after) {
        this.variableId = variableId;
        this.at = at;
        this.actorId = actorId;
        this.action = action;
        this.before = before;
        this.after = after;
    }

    public Long getId() {
        return id;
    }

    public Long getVariableId() {
        return variableId;
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

    public String getBefore() {
        return before;
    }

    public String getAfter() {
        return after;
    }
}
