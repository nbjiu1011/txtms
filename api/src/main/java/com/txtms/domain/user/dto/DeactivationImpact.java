package com.txtms.domain.user.dto;

import java.util.List;

import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.request.dto.response.RequestSummary;

/**
 * What deactivating a user affects (contract §11). {@code reviewing}: requests where the user is an assigned reviewer
 * and the review is not finished (in review → handed to the substitute; confirming or approval waiting → blocks the
 * deactivation). {@code requesting}: the user's own requests in progress (block it). {@code leadProjects}: projects
 * the user leads (go to the substitute). {@code lastApproverProjects}: approval projects whose only active approver
 * is the user (block it). {@code lastAdmin}: the user is the customer's last active admin (blocks it).
 * {@code substitutes}: usable substitute candidates (active, accepted users other than the target holding a reviewer
 * role in some project); a requester conflict is checked when deactivating.
 */
public record DeactivationImpact(List<RequestSummary> reviewing, List<RequestSummary> requesting,
        List<ProjectResponse> leadProjects, List<ProjectResponse> lastApproverProjects, boolean lastAdmin,
        List<MemberResponse> substitutes) {
}
