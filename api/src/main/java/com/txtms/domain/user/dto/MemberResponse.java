package com.txtms.domain.user.dto;

import java.time.Instant;
import java.util.List;

import com.txtms.domain.project.entity.ProjectRole;

/**
 * Contract Member (§11): a user of the customer with the admin flag and the roles per project ({@code lead} = the
 * project's lead reviewer). {@code invitationExpiresAt}: expiry of the usable invitation link of a pending user.
 */
public record MemberResponse(UserSummary user, boolean pending, boolean admin, List<ProjectRoles> projects,
        Instant invitationExpiresAt) {

    public record ProjectRoles(long projectId, List<ProjectRole> roles, boolean lead) {
    }
}
