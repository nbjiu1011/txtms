package com.txtms.domain.user.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.service.SessionService;
import com.txtms.domain.customer.service.CustomerAdminAccess;
import com.txtms.domain.customer.service.CustomerAdminAccess.Admin;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.service.ContentLockService;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ReviewWorkflowService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.user.dto.DeactivationImpact;
import com.txtms.domain.user.dto.MemberBodies.DeactivateBody;
import com.txtms.domain.user.entity.User;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Deactivation and reactivation of customer users by the customer admin (actions.md §2.13 {@code deact}, §10 #16).
 * Checks: {@link DeactivationRules}. Effects of a deactivation, in one transaction: reviews in progress go to the
 * substitute (who becomes a reviewer of the project; {@link ReviewWorkflowService#handOverOnDeactivation}), projects
 * the user leads get the substitute as lead, remaining locks are released, the account becomes inactive (kept, never
 * deleted), its sessions end, and {@code 사용자 비활성화} is audited.
 */
@Service
@Transactional
public class UserDeactivationService {

    static final Set<RequestStatus> REQUESTER_IN_PROGRESS = Set.of(RequestStatus.WAITING, RequestStatus.IN_REVIEW,
            RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);
    static final Set<RequestStatus> REVIEW_IN_PROGRESS = Set.of(RequestStatus.IN_REVIEW, RequestStatus.CONFIRMING,
            RequestStatus.APPROVAL_WAITING);
    static final Set<RequestStatus> BLOCKING_REVIEW = Set.of(RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);

    private final CustomerAdminAccess adminAccess;
    private final UserService userService;
    private final MemberAdminService members;
    private final ProjectAccess projectAccess;
    private final RequestQueryService requests;
    private final ReviewWorkflowService reviews;
    private final ContentLockService locks;
    private final SessionService sessions;
    private final AuditLogService audit;
    private final Clock clock;
    private final int maxText;

    public UserDeactivationService(CustomerAdminAccess adminAccess, UserService userService,
            MemberAdminService members, ProjectAccess projectAccess, RequestQueryService requests, ReviewWorkflowService reviews,
            ContentLockService locks, SessionService sessions, AuditLogService audit, Clock clock,
            AppProperties properties) {
        this.adminAccess = adminAccess;
        this.userService = userService;
        this.members = members;
        this.projectAccess = projectAccess;
        this.requests = requests;
        this.reviews = reviews;
        this.locks = locks;
        this.sessions = sessions;
        this.audit = audit;
        this.clock = clock;
        this.maxText = properties.content().maxInfoTextLength();
    }

    /** What the target's deactivation affects, from the customer's requests and projects. */
    private record Scope(List<Project> projects, Map<Long, ProjectFacts> facts, List<ScopedRequest> reviewing,
            List<ScopedRequest> requesting, List<Project> leadProjects, List<Project> lastApproverProjects,
            boolean lastAdmin) {

        List<ScopedRequest> handOver() {
            return reviewing.stream().filter(s -> s.request().getStatus() == RequestStatus.IN_REVIEW).toList();
        }

        List<String> blocking() {
            return reviewing.stream().filter(s -> BLOCKING_REVIEW.contains(s.request().getStatus()))
                    .map(s -> s.request().getId()).toList();
        }
    }

    @Transactional(readOnly = true)
    public DeactivationImpact impact(AuthUser auth, long customerId, long userId) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        Scope scope = scope(admin, target);
        Instant now = clock.instant();
        return new DeactivationImpact(requests.summaries(scope.reviewing(), now),
                requests.summaries(scope.requesting(), now),
                scope.leadProjects().stream().map(ProjectResponse::of).toList(),
                scope.lastApproverProjects().stream().map(ProjectResponse::of).toList(), scope.lastAdmin(),
                members.substitutesOf(admin.customer(), target.getId()));
    }

    public void deactivate(AuthUser auth, long customerId, long userId, DeactivateBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        DeactivateBody b = body == null ? new DeactivateBody(null, null) : body;
        Scope scope = scope(admin, target);
        List<ScopedRequest> handOver = scope.handOver();
        boolean needsSubstitute = !handOver.isEmpty() || !scope.leadProjects().isEmpty();
        String handover = b.handover() == null ? "" : b.handover().trim();
        if (handover.length() > maxText) {
            throw BusinessException.validation("handover", String.format("인수인계 내용은 최대 %,d자입니다", maxText));
        }
        User substitute = needsSubstitute && b.substituteUserId() != null
                ? userService.find(b.substituteUserId()).orElse(null) : null;
        DeactivationRules.Substitute substituteFacts = null;
        if (needsSubstitute && b.substituteUserId() != null) {
            substituteFacts = substituteFacts(admin, target, substitute, scope, handOver);
        }
        DeactivationRules.check(new DeactivationRules.Facts(target.getId().equals(admin.userId()),
                target.isActive() && !target.isPending(), scope.lastAdmin(), scope.blocking(),
                scope.requesting().stream().map(s -> s.request().getId()).toList(),
                scope.lastApproverProjects().stream().map(Project::getName).toList(), needsSubstitute,
                substituteFacts, !handover.isEmpty()));

        Map<Long, Project> projects = scope.projects().stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        for (ScopedRequest s : handOver) {
            Project project = projects.get(s.request().getProjectId());
            if (!project.rolesOf(substitute.getId()).contains(ProjectRole.REVIEWER)) {
                project.addRole(substitute.getId(), ProjectRole.REVIEWER);
            }
            reviews.handOverOnDeactivation(auth, s.request().getId(), target, substitute, handover);
        }
        for (Project p : scope.leadProjects()) {
            p.assignLead(substitute.getId());
        }
        locks.releaseAllOf(target.getId());
        target.deactivate(clock.instant());
        sessions.revokeAllOf(target.getId());

        List<String> detail = new ArrayList<>();
        if (substitute != null) {
            detail.add("대체자 " + substitute.getName());
        }
        if (!handOver.isEmpty()) {
            detail.add("검수 인계 " + handOver.stream().map(s -> s.request().getId())
                    .collect(Collectors.joining(", ")));
        }
        if (!scope.leadProjects().isEmpty()) {
            detail.add("대표 검수자 이관 " + scope.leadProjects().stream().map(Project::getName)
                    .collect(Collectors.joining(", ")));
        }
        audit.record(admin.userId(), admin.customerId(), "사용자 비활성화", target.getName(),
                detail.isEmpty() ? null : String.join(" / ", detail));
    }

    public void reactivate(AuthUser auth, long customerId, long userId) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        if (target.isActive() || target.isPending()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "비활성화된 사용자만 다시 사용하게 할 수 있습니다");
        }
        target.reactivate(clock.instant());
        audit.record(admin.userId(), admin.customerId(), "사용자 재활성화", target.getName(), target.getEmail());
    }

    // ------------------------------------------------------------------ helpers

    private Scope scope(Admin admin, User target) {
        List<Project> projects = projectAccess.byCustomer(admin.customerId());
        Map<Long, ProjectFacts> facts = projectAccess.factsOf(projects);
        long id = target.getId();
        List<ScopedRequest> all = requests.visible(userService.actorOf(admin.user()), projects).stream()
                .sorted(Comparator.comparing((ScopedRequest s) -> s.request().getId()))
                .toList();
        List<ScopedRequest> reviewing = all.stream()
                .filter(s -> REVIEW_IN_PROGRESS.contains(s.request().getStatus())
                        && s.request().getReviewerIds().contains(id))
                .toList();
        List<ScopedRequest> requesting = all.stream()
                .filter(s -> REQUESTER_IN_PROGRESS.contains(s.request().getStatus())
                        && s.request().getRequesterId() == id)
                .toList();
        List<Project> leads = projects.stream().filter(p -> Long.valueOf(id).equals(p.getLeadUserId())).toList();
        List<Project> lastApprover = !admin.customer().isApprovalEnabled() ? List.of()
                : projects.stream().filter(p -> {
                    List<Long> approvers = facts.get(p.getId()).activeApprovers();
                    return approvers.size() == 1 && approvers.getFirst() == id;
                }).toList();
        boolean lastAdmin = target.isAdminOf(admin.customerId())
                && userService.activeAdminIdsOf(admin.customerId()).stream().noneMatch(a -> a != id);
        return new Scope(projects, facts, reviewing, requesting, leads, lastApprover, lastAdmin);
    }

    /**
     * Usable: an active, not pending user of the customer other than the target, holding the reviewer role in some
     * project. Conflict: requester of a handed-over request or requester role in an affected project.
     */
    private DeactivationRules.Substitute substituteFacts(Admin admin, User target, User substitute, Scope scope,
            List<ScopedRequest> handOver) {
        if (substitute == null || !admin.customer().getId().equals(substitute.getCustomerId())
                || !substitute.isActive() || substitute.isPending() || substitute.getId().equals(target.getId())) {
            return new DeactivationRules.Substitute(false, false);
        }
        long sid = substitute.getId();
        boolean reviewer = scope.projects().stream().anyMatch(p -> p.rolesOf(sid).contains(ProjectRole.REVIEWER));
        boolean conflict = handOver.stream().anyMatch(s -> s.request().getRequesterId() == sid
                || scope.facts().get(s.request().getProjectId()).hasRole(sid, ProjectRole.REQUESTER))
                || scope.leadProjects().stream().anyMatch(p -> p.rolesOf(sid).contains(ProjectRole.REQUESTER));
        return new DeactivationRules.Substitute(reviewer, conflict);
    }

}
