package com.txtms.domain.project.entity;

import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/** One (user, role) grant inside a project. */
@Embeddable
public class ProjectMember {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ProjectRole role;

    protected ProjectMember() {
    }

    public ProjectMember(Long userId, ProjectRole role) {
        this.userId = userId;
        this.role = role;
    }

    public Long getUserId() {
        return userId;
    }

    public ProjectRole getRole() {
        return role;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ProjectMember other && Objects.equals(userId, other.userId) && role == other.role;
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, role);
    }
}
