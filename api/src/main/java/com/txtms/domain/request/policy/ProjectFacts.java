package com.txtms.domain.request.policy;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import com.txtms.domain.project.entity.ProjectRole;

/**
 * Project and customer facts needed by the request policy.
 *
 * @param roles         project roles per user (members only)
 * @param activeUserIds users of the project whose account is active (eligibility of approvers and reviewers)
 */
public record ProjectFacts(
        long projectId,
        long customerId,
        String projectName,
        boolean projectActive,
        boolean customerActive,
        boolean approvalEnabled,
        int dueSoonDays,
        Long leadUserId,
        Map<Long, Set<ProjectRole>> roles,
        Set<Long> activeUserIds) {

    public ProjectFacts {
        TreeMap<Long, Set<ProjectRole>> copy = new TreeMap<>();
        roles.forEach((user, rs) -> {
            if (!rs.isEmpty()) {
                copy.put(user, Set.copyOf(rs));
            }
        });
        roles = copy;
        activeUserIds = Set.copyOf(activeUserIds);
    }

    public Set<ProjectRole> rolesOf(long userId) {
        Set<ProjectRole> rs = roles.get(userId);
        return rs == null ? EnumSet.noneOf(ProjectRole.class) : EnumSet.copyOf(rs);
    }

    public boolean hasRole(long userId, ProjectRole role) {
        Set<ProjectRole> rs = roles.get(userId);
        return rs != null && rs.contains(role);
    }

    /** A member holds at least one project role. */
    public boolean member(long userId) {
        return roles.containsKey(userId);
    }

    public boolean lead(long userId) {
        return leadUserId != null && leadUserId == userId;
    }

    /** Active users with the approver role, ordered by id. */
    public List<Long> activeApprovers() {
        return activeWithRole(ProjectRole.APPROVER);
    }

    /** Active users with the reviewer role, ordered by id. */
    public List<Long> activeReviewers() {
        return activeWithRole(ProjectRole.REVIEWER);
    }

    private List<Long> activeWithRole(ProjectRole role) {
        return roles.entrySet().stream()
                .filter(e -> e.getValue().contains(role) && activeUserIds.contains(e.getKey()))
                .map(Map.Entry::getKey)
                .toList();
    }
}
