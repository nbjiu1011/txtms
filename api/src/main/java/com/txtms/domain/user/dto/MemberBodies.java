package com.txtms.domain.user.dto;

import java.util.List;

import com.txtms.domain.project.entity.ProjectRole;

/** Request bodies of the customer admin's user management (contract §11). */
public final class MemberBodies {

    private MemberBodies() {
    }

    /** {@code PUT …/project-roles}: the listed projects get exactly these roles (empty = membership removed). */
    public record ProjectRolesBody(List<ProjectRolesItem> projects) {
    }

    public record ProjectRolesItem(Long projectId, List<ProjectRole> roles) {
    }

    public record InvitationBody(String email, String name, String dept, Long projectId, ProjectRole role,
            Boolean externalDomainConfirmed) {
    }

    public record EmailBody(String email, Boolean externalDomainConfirmed) {
    }

    public record DeactivateBody(Long substituteUserId, String handover) {
    }
}
