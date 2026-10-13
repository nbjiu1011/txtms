package com.txtms.domain.request.policy;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.request.entity.RequestStatus;

/** Small cast for policy tests: one project of customer 100 with approval enabled. */
final class PolicyFixtures {

    static final long CUSTOMER = 100;
    static final long OTHER_CUSTOMER = 200;
    static final long PROJECT = 10;

    static final long REQUESTER = 1;
    static final long REVIEWER = 2;
    static final long LEAD = 3;
    static final long APPROVER = 4;
    static final long INACTIVE_APPROVER = 5;
    static final long REQUESTER_2 = 6;
    static final long ADMIN = 11;
    static final long OPERATOR = 50;
    static final long OUTSIDER = 99;

    private PolicyFixtures() {
    }

    static ProjectFacts project(boolean approvalEnabled) {
        return project(approvalEnabled, true);
    }

    static ProjectFacts project(boolean approvalEnabled, boolean customerActive) {
        Map<Long, Set<ProjectRole>> roles = Map.of(
                REQUESTER, EnumSet.of(ProjectRole.REQUESTER),
                REQUESTER_2, EnumSet.of(ProjectRole.REQUESTER),
                REVIEWER, EnumSet.of(ProjectRole.REVIEWER),
                LEAD, EnumSet.of(ProjectRole.REVIEWER),
                APPROVER, EnumSet.of(ProjectRole.APPROVER),
                INACTIVE_APPROVER, EnumSet.of(ProjectRole.APPROVER));
        return new ProjectFacts(PROJECT, CUSTOMER, "프로젝트", true, customerActive, approvalEnabled, 3, LEAD, roles,
                Set.of(REQUESTER, REQUESTER_2, REVIEWER, LEAD, APPROVER));
    }

    static Actor actor(long userId) {
        return new Actor(userId, true, false, Set.of());
    }

    static Actor admin() {
        return new Actor(ADMIN, true, false, Set.of(CUSTOMER));
    }

    static Actor otherCustomerAdmin() {
        return new Actor(ADMIN, true, false, Set.of(OTHER_CUSTOMER));
    }

    static Actor operator() {
        return new Actor(OPERATOR, true, true, Set.of());
    }

    static Actor inactive(long userId) {
        return new Actor(userId, false, false, Set.of());
    }

    static RequestFacts request(RequestStatus status) {
        return request(status, false);
    }

    /** Requested by REQUESTER, reviewed by REVIEWER (primary) and LEAD once assigned. */
    static RequestFacts request(RequestStatus status, boolean recall) {
        boolean assigned = status != RequestStatus.DRAFT && status != RequestStatus.WAITING;
        return new RequestFacts("REQ-2610-121", PROJECT, status, REQUESTER,
                assigned ? List.of(REVIEWER, LEAD) : List.of(), assigned ? REVIEWER : null, recall,
                LocalDate.of(2026, 10, 9), status != RequestStatus.DRAFT);
    }
}
