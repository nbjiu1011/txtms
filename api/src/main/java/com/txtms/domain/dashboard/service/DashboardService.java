package com.txtms.domain.dashboard.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.dashboard.dto.DashboardResponse;
import com.txtms.domain.dashboard.dto.DashboardResponse.Kpi;
import com.txtms.domain.dashboard.dto.DashboardResponse.PipelineStage;
import com.txtms.domain.dashboard.dto.DashboardResponse.Todo;
import com.txtms.domain.dashboard.dto.WorkloadRow;
import com.txtms.domain.notice.service.NoticeService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.response.RequestSummary;
import com.txtms.domain.request.dto.response.Volume;
import com.txtms.domain.request.entity.FileUnit;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.policy.RequestView;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

/**
 * Project dashboard. KPI counts use the same view predicates as {@code GET /api/requests?view=}, so a KPI and the
 * list behind it always agree.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {

    static final int RECENT_LIMIT = 6;
    static final int NOTICE_LIMIT = 4;
    static final int TODO_LIMIT = 100;

    private static final Set<RequestStatus> WORKLOAD_STATUSES =
            Set.of(RequestStatus.IN_REVIEW, RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);

    private final ProjectAccess projectAccess;
    private final CustomerService customerService;
    private final UserService userService;
    private final RequestQueryService requests;
    private final RequestPolicy policy;
    private final NoticeService notices;
    private final Clock clock;

    public DashboardService(ProjectAccess projectAccess, CustomerService customerService, UserService userService,
            RequestQueryService requests, RequestPolicy policy, NoticeService notices, Clock clock) {
        this.projectAccess = projectAccess;
        this.customerService = customerService;
        this.userService = userService;
        this.requests = requests;
        this.policy = policy;
        this.notices = notices;
        this.clock = clock;
    }

    public DashboardResponse dashboard(AuthUser auth, long projectId) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, projectId);
        Customer customer = customerService.require(project.getCustomerId());
        Actor actor = userService.actorOf(user);
        ProjectFacts facts = projectAccess.facts(project);
        Instant now = clock.instant();
        long me = user.getId();

        List<ScopedRequest> inProject = requests.visible(actor, List.of(project)).stream()
                .sorted(RequestQueryService.NEWEST_FIRST).toList();
        Set<ProjectRole> roles = facts.rolesOf(me);
        boolean lead = facts.lead(me);
        boolean admin = actor.adminOf(customer.getId());

        List<Kpi> kpis = new ArrayList<>();
        if (roles.contains(ProjectRole.REQUESTER)) {
            kpis.add(kpi(RequestView.MY_DRAFT, "작성 중", RequestStatus.DRAFT, inProject, actor, now));
            kpis.add(kpi(RequestView.MY_CONFIRMING, "답변 필요", RequestStatus.CONFIRMING, inProject, actor, now));
            kpis.add(kpi(RequestView.MY_IN_PROGRESS, "진행 중", RequestStatus.IN_REVIEW, inProject, actor, now));
        }
        if (roles.contains(ProjectRole.REVIEWER)) {
            kpis.add(kpi(RequestView.MY_REVIEW, "내 검수", RequestStatus.IN_REVIEW, inProject, actor, now));
            kpis.add(kpi(RequestView.RECALL_PENDING, "회수 처리 필요", RequestStatus.CONFIRMING, inProject, actor, now));
        }
        if (lead) {
            kpis.add(kpi(RequestView.WAITING_ASSIGNMENT, "배정 대기", RequestStatus.WAITING, inProject, actor, now));
            kpis.add(kpi(RequestView.OVERDUE, "지연", RequestStatus.CONFIRMING, inProject, actor, now));
        }
        if (roles.contains(ProjectRole.REVIEWER) || lead) {
            kpis.add(kpi(RequestView.DUE_SOON, "납기 임박", RequestStatus.WAITING, inProject, actor, now));
        }
        if (roles.contains(ProjectRole.APPROVER)) {
            kpis.add(kpi(RequestView.APPROVAL_PENDING, "승인 대기", RequestStatus.APPROVAL_WAITING, inProject, actor,
                    now));
        }
        if (admin) {
            List<ScopedRequest> inCustomer = requests.visible(actor,
                    projectAccess.requestScope(user, null, customer.getId()));
            kpis.add(kpi(RequestView.CUSTOMER_IN_PROGRESS, "고객사 진행 중", RequestStatus.IN_REVIEW, inCustomer, actor,
                    now));
            kpis.add(kpi(RequestView.CUSTOMER_COMPLETED, "고객사 완료", RequestStatus.REVIEW_COMPLETED, inCustomer,
                    actor, now));
        }

        List<RequestStatus> stages = customer.isApprovalEnabled()
                ? List.of(RequestStatus.DRAFT, RequestStatus.WAITING, RequestStatus.IN_REVIEW,
                        RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING, RequestStatus.APPROVED)
                : List.of(RequestStatus.DRAFT, RequestStatus.WAITING, RequestStatus.IN_REVIEW,
                        RequestStatus.CONFIRMING, RequestStatus.REVIEW_COMPLETED);
        List<PipelineStage> pipeline = stages.stream()
                .map(st -> new PipelineStage(st,
                        (int) inProject.stream().filter(s -> s.request().getStatus() == st).count()))
                .toList();

        List<Todo> todos = todos(actor, inProject, now);
        List<RequestSummary> recent = requests.summaries(inProject.stream().limit(RECENT_LIMIT).toList(), now, actor);
        List<WorkloadRow> workload = lead ? workloadRows(List.of(facts), inProject, now) : List.of();

        return new DashboardResponse(kpis, pipeline, inProject.size(), todos, recent, workload,
                notices.latest(user, customer, NOTICE_LIMIT), admin && !facts.member(me));
    }

    /** Workload of the project's active reviewers (lead reviewer and customer admins only). */
    public List<WorkloadRow> workload(AuthUser auth, long projectId) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, projectId);
        Actor actor = userService.actorOf(user);
        ProjectFacts facts = projectAccess.facts(project);
        if (!facts.lead(user.getId()) && !actor.adminOf(project.getCustomerId())) {
            throw BusinessException.forbidden();
        }
        return workloadRows(List.of(facts), requests.visible(actor, List.of(project)), clock.instant());
    }

    private Kpi kpi(RequestView view, String label, RequestStatus tone, List<ScopedRequest> scope, Actor actor,
            Instant now) {
        int count = (int) scope.stream().filter(s -> requests.matchesView(view, actor, s, now, Set.of())).count();
        return new Kpi(view, label, tone, count);
    }

    private List<Todo> todos(Actor actor, List<ScopedRequest> inProject, Instant now) {
        List<Todo> todos = new ArrayList<>();
        for (ScopedRequest s : inProject) {
            Set<RequestAction> allowed = policy.allowedActions(actor, s.project(), s.facts());
            if (allowed.contains(RequestAction.ANSWER)) {
                todos.add(todo(s, RequestAction.ANSWER, "확인 요청에 답변", RequestStatus.CONFIRMING, now));
            }
            if (allowed.contains(RequestAction.DECIDE_RECALL)) {
                todos.add(todo(s, RequestAction.DECIDE_RECALL, "회수 요청 승인 또는 거절", RequestStatus.CONFIRMING, now));
            }
            if (allowed.contains(RequestAction.ASSIGN)) {
                todos.add(todo(s, RequestAction.ASSIGN, "검수자 배정", RequestStatus.WAITING, now));
            }
            if (allowed.contains(RequestAction.COMPLETE)) {
                todos.add(todo(s, RequestAction.COMPLETE, "검수 완료 처리 (주담당)", RequestStatus.IN_REVIEW, now));
            } else if (allowed.contains(RequestAction.REVIEW) && !s.facts().recallPending()) {
                todos.add(todo(s, RequestAction.REVIEW, "검수 진행", RequestStatus.IN_REVIEW, now));
            }
            if (allowed.contains(RequestAction.APPROVE)) {
                todos.add(todo(s, RequestAction.APPROVE, "최종 승인", RequestStatus.APPROVAL_WAITING, now));
            }
            if (s.request().getStatus() == RequestStatus.DRAFT && s.facts().requester(actor.userId())) {
                todos.add(todo(s, RequestAction.EDIT_REQUEST, "작성 이어하기", RequestStatus.DRAFT, now));
            }
            if (todos.size() >= TODO_LIMIT) {
                break;
            }
        }
        return todos.size() > TODO_LIMIT ? List.copyOf(todos.subList(0, TODO_LIMIT)) : todos;
    }

    private Todo todo(ScopedRequest s, RequestAction action, String label, RequestStatus tone, Instant now) {
        return new Todo(s.request().getId(), action, label, tone, s.request().getTitle(), s.request().getType(),
                s.project().projectName(), s.request().getDueDate(), policy.overdue(s.facts(), now),
                policy.dueSoon(s.project(), s.facts(), now));
    }

    /**
     * Workload of the active reviewers of the given projects (one row per reviewer, ordered by user id) over the
     * given requests in review, confirming or approval waiting.
     */
    public List<WorkloadRow> workloadRows(java.util.Collection<ProjectFacts> projects, List<ScopedRequest> inProject,
            Instant now) {
        java.util.SortedSet<Long> reviewerIds = new java.util.TreeSet<>();
        projects.forEach(f -> reviewerIds.addAll(f.activeReviewers()));
        List<ScopedRequest> active = inProject.stream()
                .filter(s -> WORKLOAD_STATUSES.contains(s.request().getStatus()))
                .toList();
        List<RequestSummary> summaries = requests.summaries(active, now);
        List<WorkloadRow> rows = new ArrayList<>();
        for (long reviewer : reviewerIds) {
            int count = 0;
            int primary = 0;
            int due = 0;
            int chars = 0;
            Map<FileUnit, Integer> units = new EnumMap<>(FileUnit.class);
            for (RequestSummary r : summaries) {
                if (!r.reviewerIds().contains(reviewer)) {
                    continue;
                }
                count++;
                if (r.primaryReviewerId() != null && r.primaryReviewerId() == reviewer) {
                    primary++;
                }
                if (r.dueSoon() || r.overdue()) {
                    due++;
                }
                chars += r.volume().chars();
                r.volume().files().forEach(f -> units.merge(f.unit(), f.amount(), Integer::sum));
            }
            List<Volume.FileVolume> files = new ArrayList<>();
            units.forEach((u, a) -> files.add(new Volume.FileVolume(u, a)));
            rows.add(new WorkloadRow(reviewer, count, primary, due, chars, files));
        }
        return rows;
    }
}
