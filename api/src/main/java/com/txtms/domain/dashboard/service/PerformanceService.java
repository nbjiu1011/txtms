package com.txtms.domain.dashboard.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedSet;
import java.util.TreeSet;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.dashboard.dto.PerformanceResponse;
import com.txtms.domain.dashboard.service.PerformanceCalculator.HistoryRow;
import com.txtms.domain.dashboard.service.PerformanceCalculator.Period;
import com.txtms.domain.dashboard.service.PerformanceCalculator.RequestRow;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.common.Kst;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * {@code GET /api/performance}: statistics of the projects the caller manages (the lead reviewer's projects, every
 * project of the customer for a customer admin), see {@link PerformanceCalculator}.
 */
@Service
@Transactional(readOnly = true)
public class PerformanceService {

    /** Default period when {@code from} is omitted: the last 30 days up to {@code to} (prototype "최근 30일"). */
    static final int DEFAULT_DAYS = 30;

    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final RequestQueryService requests;
    private final DashboardService dashboards;
    private final Clock clock;

    public PerformanceService(ProjectAccess projectAccess, UserService userService, RequestQueryService requests,
            DashboardService dashboards, Clock clock) {
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.requests = requests;
        this.dashboards = dashboards;
        this.clock = clock;
    }

    public PerformanceResponse performance(AuthUser auth, long customerId, Long projectId, LocalDate from,
            LocalDate to, Long userId) {
        User user = userService.require(auth.userId());
        Actor actor = userService.actorOf(user);
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        List<Project> scope = scope(user, actor, customer, projectId);

        Instant now = clock.instant();
        LocalDate toDate = to != null ? to : Kst.dateOf(now);
        LocalDate fromDate = from != null ? from : toDate.minusDays(DEFAULT_DAYS - 1L);
        if (fromDate.isAfter(toDate)) {
            throw BusinessException.validation("from", "집계 시작일은 종료일보다 늦을 수 없습니다");
        }

        Map<Long, ProjectFacts> facts = projectAccess.factsOf(scope);
        List<ScopedRequest> inScope = requests.visible(actor, scope);
        List<String> ids = inScope.stream().map(s -> s.request().getId()).toList();
        Map<String, Integer> counts = requests.contentCounts(ids);
        List<RequestRow> rows = inScope.stream().map(s -> {
            Request r = s.request();
            return new RequestRow(r.getId(), r.getStatus(), r.isDemo(), r.isCancelled(), r.getSubmittedAt(),
                    r.getCompletedAt(), counts.getOrDefault(r.getId(), 0), r.getReviewerIds());
        }).toList();
        Set<String> actions = new HashSet<>(PerformanceCalculator.ASSIGNMENT_ACTIONS);
        actions.add(PerformanceCalculator.COMPLETE_ACTION);
        List<HistoryRow> history = requests.historyOf(ids, actions).stream()
                .map(h -> new HistoryRow(h.getRequestId(), h.getActorId(), h.getAction(), h.getAt()))
                .toList();

        SortedSet<Long> reviewers = new TreeSet<>();
        facts.values().forEach(f -> reviewers.addAll(f.activeReviewers()));
        List<Long> people = new ArrayList<>(reviewers);
        if (userId != null) {
            people = people.stream().filter(userId::equals).toList();
        }

        PerformanceCalculator.Result result = PerformanceCalculator.compute(rows, history, people,
                Period.kst(fromDate, toDate));
        return new PerformanceResponse(fromDate, toDate, scope.stream().map(Project::getId).toList(),
                result.received(), result.receivedContents(), result.receivedCompleted(), result.completionRate(),
                result.completedInPeriod(), result.completedContents(), result.inProgress(),
                result.people().stream().map(p -> new PerformanceResponse.PersonRow(p.userId(),
                        p.completedAsPrimary(), p.coReviewed(), p.assignmentsManaged(), p.active())).toList(),
                dashboards.workloadRows(facts.values(), inScope, now));
    }

    /**
     * Projects the statistics cover. One project: the caller must lead it or administer its customer (FORBIDDEN
     * otherwise; projects outside the caller's scope NOT_FOUND). No project: every project the caller leads in the
     * customer, or all of them for a customer admin; FORBIDDEN when there is none.
     */
    private List<Project> scope(User user, Actor actor, Customer customer, Long projectId) {
        boolean admin = actor.adminOf(customer.getId());
        if (projectId != null) {
            Project project = projectAccess.requireWorkProject(user, projectId);
            if (!project.getCustomerId().equals(customer.getId())) {
                throw BusinessException.notFound();
            }
            if (!admin && !user.getId().equals(project.getLeadUserId())) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "대표 검수자 또는 고객사 관리자만 실적을 볼 수 있습니다");
            }
            return List.of(project);
        }
        List<Project> projects = projectAccess.requestScope(user, null, customer.getId()).stream()
                .filter(p -> admin || user.getId().equals(p.getLeadUserId()))
                .toList();
        if (projects.isEmpty()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "대표 검수자 또는 고객사 관리자만 실적을 볼 수 있습니다");
        }
        return projects;
    }
}
