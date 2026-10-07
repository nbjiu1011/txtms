package com.txtms.domain.project.service;

import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

import com.txtms.domain.project.entity.ProjectRole;

/**
 * Project role rules of the customer admin (pure, actions.md §2.13 {@code roleEdit}/{@code projEdit}, screens-b §12).
 */
public final class ProjectRoleRules {

    public static final String EXCLUSIVE = "요청자와 검수자는 함께 줄 수 없습니다";
    public static final String LEAD_IS_REQUESTER = "요청자 역할을 가진 사용자는 대표 검수자가 될 수 없습니다";
    public static final String APPROVAL_NOT_USED = "이 고객사는 승인 단계를 쓰지 않습니다";

    private ProjectRoleRules() {
    }

    /** What the rule check needs to know about the user in one project. */
    public record Facts(String projectName, boolean approvalEnabled, boolean lead, boolean assignedInProgress,
            boolean onlyActiveApprover) {
    }

    /**
     * The first problem of changing the user's roles in one project from {@code before} to {@code after}, or null.
     * Order: requester + reviewer together → approver without approval → removing the lead's reviewer role →
     * removing the reviewer role while assigned to an unfinished review → removing the last active approver.
     */
    public static String problem(Facts f, Set<ProjectRole> before, Set<ProjectRole> after) {
        if (after.contains(ProjectRole.REQUESTER) && after.contains(ProjectRole.REVIEWER)) {
            return EXCLUSIVE;
        }
        if (after.contains(ProjectRole.APPROVER) && !before.contains(ProjectRole.APPROVER) && !f.approvalEnabled()) {
            return APPROVAL_NOT_USED;
        }
        boolean reviewerRemoved = before.contains(ProjectRole.REVIEWER) && !after.contains(ProjectRole.REVIEWER);
        if (reviewerRemoved && f.lead()) {
            return f.projectName() + ": 대표 검수자의 검수자 역할은 해제할 수 없습니다. 프로젝트 관리에서 대표 검수자를 먼저 바꾸세요";
        }
        if (reviewerRemoved && f.assignedInProgress()) {
            return f.projectName() + ": 진행 중인 검수가 있어 검수자 역할을 해제할 수 없습니다. 먼저 검수자를 변경하세요";
        }
        boolean approverRemoved = before.contains(ProjectRole.APPROVER) && !after.contains(ProjectRole.APPROVER);
        if (approverRemoved && f.approvalEnabled() && f.onlyActiveApprover()) {
            return f.projectName() + ": 마지막 승인자라 해제할 수 없습니다";
        }
        return null;
    }

    /** {@code 요청자, 검수자} in enum order, {@code 없음} when empty (audit wording). */
    public static String label(Set<ProjectRole> roles) {
        if (roles.isEmpty()) {
            return "없음";
        }
        return EnumSet.copyOf(roles).stream().map(ProjectRoleRules::label).collect(Collectors.joining(", "));
    }

    public static String label(ProjectRole role) {
        return switch (role) {
            case REQUESTER -> "요청자";
            case REVIEWER -> "검수자";
            case APPROVER -> "승인자";
        };
    }
}
