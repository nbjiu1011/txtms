package com.txtms.domain.request.policy;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * The single request authorization policy: visibility, {@code allowedActions}, list views and "pending work".
 * Pure Java (no I/O). Controllers and services re-check every action with {@link #require}.
 */
@Component
public class RequestPolicy {

    /**
     * A request is visible to an active user of an active customer who is a project member or an admin of the
     * customer. Drafts are visible to their author only (admins included). Operators never see content.
     */
    public boolean canView(Actor actor, ProjectFacts project, RequestFacts request) {
        if (!actor.active() || !project.customerActive() || request.projectId() != project.projectId()) {
            return false;
        }
        if (request.status() == RequestStatus.DRAFT && !request.requester(actor.userId())) {
            return false;
        }
        return project.member(actor.userId()) || actor.adminOf(project.customerId());
    }

    /**
     * Why the actor cannot see the request, or null when they can. Other customers, operators, inactive accounts or
     * customers: NOT_FOUND (existence is never revealed). Same customer: someone else's draft is DRAFT_PRIVATE,
     * anything else (e.g. a project the user is not a member of) FORBIDDEN.
     */
    public BusinessException visibilityFailure(Actor actor, ProjectFacts project, RequestFacts request) {
        if (canView(actor, project, request)) {
            return null;
        }
        boolean sameCustomer = actor.active() && !actor.operator() && project.customerActive()
                && request.projectId() == project.projectId() && actor.belongsTo(project.customerId());
        if (!sameCustomer) {
            return BusinessException.notFound();
        }
        if (request.status() == RequestStatus.DRAFT && !request.requester(actor.userId())) {
            return new BusinessException(ErrorCode.DRAFT_PRIVATE,
                    request.id() + "는 아직 작성 중인 요청입니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다.");
        }
        return BusinessException.forbidden();
    }

    /** Throws the {@link #visibilityFailure} when the actor cannot see the request. */
    public void requireView(Actor actor, ProjectFacts project, RequestFacts request) {
        BusinessException failure = visibilityFailure(actor, project, request);
        if (failure != null) {
            throw failure;
        }
    }

    /**
     * Active approvers of the project who are neither the requester, an assigned reviewer nor the primary reviewer.
     * Empty when the customer does not use approval.
     */
    public List<Long> eligibleApprovers(ProjectFacts project, RequestFacts request) {
        if (!project.approvalEnabled()) {
            return List.of();
        }
        return project.activeApprovers().stream()
                .filter(id -> !request.requester(id) && !request.reviewer(id) && !request.primary(id))
                .toList();
    }

    public Set<RequestAction> allowedActions(Actor actor, ProjectFacts project, RequestFacts request) {
        Set<RequestAction> actions = EnumSet.noneOf(RequestAction.class);
        if (!canView(actor, project, request)) {
            return actions;
        }
        long me = actor.userId();
        boolean requester = request.requester(me);
        boolean reviewer = request.reviewer(me);
        boolean primary = request.primary(me);
        boolean lead = project.lead(me);
        boolean admin = actor.adminOf(project.customerId());
        boolean recall = request.recallPending();
        boolean eligibleApprover = eligibleApprovers(project, request).contains(me);
        RequestStatus status = request.status();

        switch (status) {
            case DRAFT -> {
                if (requester) {
                    actions.addAll(EnumSet.of(RequestAction.EDIT_REQUEST, RequestAction.EDIT_CONTENT,
                            RequestAction.SUBMIT));
                }
            }
            case WAITING -> {
                if (requester) {
                    actions.add(RequestAction.CANCEL);
                }
                if (lead) {
                    actions.add(RequestAction.ASSIGN);
                }
            }
            case IN_REVIEW -> {
                if (requester && !recall) {
                    actions.add(RequestAction.RECALL);
                }
                if (primary && recall) {
                    actions.add(RequestAction.DECIDE_RECALL);
                }
                if (lead) {
                    actions.add(RequestAction.CHANGE_ASSIGNMENT);
                }
                if (reviewer) {
                    actions.add(RequestAction.REVIEW);
                    actions.add(RequestAction.EDIT_CONTENT);
                }
                if (primary && !recall) {
                    actions.add(RequestAction.COMPLETE);
                }
                if (lead || admin) {
                    actions.add(RequestAction.UNLOCK);
                }
            }
            case CONFIRMING -> {
                if (requester) {
                    actions.add(RequestAction.ANSWER);
                    actions.add(RequestAction.EDIT_CONTENT);
                }
                if (lead || admin) {
                    actions.add(RequestAction.UNLOCK);
                }
            }
            case APPROVAL_WAITING -> {
                if (eligibleApprover) {
                    actions.add(RequestAction.APPROVE);
                    actions.add(RequestAction.REVISE);
                }
            }
            case REVIEW_COMPLETED, APPROVED -> actions.add(RequestAction.EXPORT);
        }

        if (status != RequestStatus.DRAFT && !status.isFinal()) {
            boolean canEditDue = status == RequestStatus.APPROVAL_WAITING
                    ? eligibleApprover
                    : admin || lead || project.hasRole(me, ProjectRole.APPROVER);
            if (canEditDue) {
                actions.add(RequestAction.EDIT_DUE);
            }
        }

        if (project.hasRole(me, ProjectRole.REQUESTER)) {
            actions.add(RequestAction.CLONE);
            if (status.isFinal()) {
                actions.add(RequestAction.FOLLOW_UP);
            }
        }
        return actions;
    }

    public boolean allows(Actor actor, ProjectFacts project, RequestFacts request, RequestAction action) {
        return allowedActions(actor, project, request).contains(action);
    }

    /**
     * Server-side check before executing an action: invisible requests are reported as missing, visible ones that
     * do not allow the action as a state conflict.
     */
    public void require(Actor actor, ProjectFacts project, RequestFacts request, RequestAction action) {
        requireView(actor, project, request);
        if (!allows(actor, project, request, action)) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
    }

    /**
     * Whether {@code user} still has work to do on the request: waiting → lead, confirming → requester, approval
     * waiting → active approvers other than the requester and assigned reviewers, in review → the primary reviewer
     * while a recall is pending, otherwise the assigned reviewers.
     */
    public boolean isPendingFor(Actor user, ProjectFacts project, RequestFacts request) {
        if (!canView(user, project, request)) {
            return false;
        }
        long id = user.userId();
        return switch (request.status()) {
            case WAITING -> project.lead(id);
            case CONFIRMING -> request.requester(id);
            case APPROVAL_WAITING -> project.activeApprovers().contains(id) && !request.requester(id)
                    && !request.reviewer(id);
            case IN_REVIEW -> request.recallPending() ? request.primary(id) : request.reviewer(id);
            default -> false;
        };
    }

    public boolean dueSoon(ProjectFacts project, RequestFacts request, Instant now) {
        return DueStatus.dueSoon(request.status(), request.dueDate(), now, project.dueSoonDays());
    }

    public boolean overdue(RequestFacts request, Instant now) {
        return DueStatus.overdue(request.status(), request.dueDate(), now);
    }

    /** "Mine" filter of the request list: authored, assigned, or approvable by me. */
    public boolean mine(Actor actor, ProjectFacts project, RequestFacts request) {
        long me = actor.userId();
        return request.requester(me) || request.reviewer(me)
                || allows(actor, project, request, RequestAction.APPROVE);
    }

    /**
     * List view predicate. Assumes the request is visible to the actor ({@link #canView}).
     *
     * @param processedByMe ids of requests the actor approved or sent back for revision
     */
    public boolean matches(RequestView view, Actor actor, ProjectFacts project, RequestFacts request, Instant now,
            Set<String> processedByMe) {
        long me = actor.userId();
        RequestStatus s = request.status();
        return switch (view) {
            case MY_DRAFT -> request.requester(me) && s == RequestStatus.DRAFT;
            case MY_CONFIRMING -> request.requester(me) && s == RequestStatus.CONFIRMING;
            case MY_IN_PROGRESS -> request.requester(me) && (s == RequestStatus.WAITING
                    || s == RequestStatus.IN_REVIEW || s == RequestStatus.APPROVAL_WAITING);
            case MY_REVIEW -> request.reviewer(me) && s == RequestStatus.IN_REVIEW;
            case RECALL_PENDING -> request.primary(me) && request.recallPending() && s == RequestStatus.IN_REVIEW;
            case WAITING_ASSIGNMENT -> s == RequestStatus.WAITING && project.lead(me);
            case OVERDUE -> overdue(request, now);
            case DUE_SOON -> dueSoon(project, request, now)
                    && (project.lead(me) || request.reviewer(me) || request.requester(me));
            case APPROVAL_PENDING -> allows(actor, project, request, RequestAction.APPROVE);
            case CUSTOMER_IN_PROGRESS -> s != RequestStatus.DRAFT && !s.isFinal();
            case CUSTOMER_COMPLETED -> s.isFinal();
            case MY_ASSIGNED_ACTIVE -> request.reviewer(me) && !s.isFinal();
            case MY_ASSIGNED_DONE -> request.reviewer(me) && s.isFinal();
            case MY_ASSIGNED_CONFIRMING -> request.reviewer(me) && s == RequestStatus.CONFIRMING;
            case APPROVAL_QUEUE -> s == RequestStatus.APPROVAL_WAITING;
            case APPROVAL_PROCESSED -> processedByMe.contains(request.id());
        };
    }
}
