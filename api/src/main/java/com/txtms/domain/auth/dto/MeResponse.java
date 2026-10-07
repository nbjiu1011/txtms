package com.txtms.domain.auth.dto;

import java.time.Instant;
import java.util.List;

import com.txtms.domain.project.entity.ProjectRole;

/** Contract Me (§1.1). */
public record MeResponse(
        long id,
        String name,
        String dept,
        String email,
        Long customerId,
        boolean operator,
        List<Long> adminCustomerIds,
        String avatarColor,
        boolean demo,
        List<Membership> memberships,
        SessionInfo session) {

    public record Membership(long projectId, long customerId, List<ProjectRole> roles, boolean lead) {
    }

    public record SessionInfo(boolean remember, Instant expiresAt) {
    }
}
