package com.txtms.domain.variable.entity;

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

/**
 * Project variable used as {@code #{key}} in contents. Deleted variables stay (logical delete) so their key is
 * never reused and their history is kept.
 */
@Entity
@Table(name = "variables")
public class Variable extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private Long projectId;

    @Column(name = "var_key", nullable = false, length = 64)
    private String key;

    @Column(length = 200)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "var_type", nullable = false, length = 10)
    private VariableType type;

    @Column(columnDefinition = "text")
    private String value;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    protected Variable() {
    }

    public Variable(Long projectId, String key, String description, VariableType type, String value, Long createdBy,
            Instant now) {
        this.projectId = projectId;
        this.key = key;
        this.description = description;
        this.type = type;
        this.value = value;
        this.active = true;
        this.createdBy = createdBy;
        initTimestamps(now);
    }

    public void change(String key, String description, VariableType type, String value, boolean active, Instant now) {
        this.key = key;
        this.description = description;
        this.type = type;
        this.value = value;
        this.active = active;
        touch(now);
    }

    public void delete(Instant now) {
        this.active = false;
        this.deleted = true;
        touch(now);
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getKey() {
        return key;
    }

    public String getDescription() {
        return description;
    }

    public VariableType getType() {
        return type;
    }

    public String getValue() {
        return value;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
