package com.txtms.domain.ops.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.service.SessionService;
import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.correction.service.DatasetService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.ops.dto.OpsDtos.CreateCustomerBody;
import com.txtms.domain.ops.dto.OpsDtos.OpsCustomer;
import com.txtms.domain.ops.dto.OpsDtos.OpsDashboard;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.project.service.ProjectAdminService;
import com.txtms.domain.request.service.RequestStatsService;
import com.txtms.domain.request.service.RequestStatsService.RequestCounts;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Customers of the solution operator (actions.md §2.14 {@code opsCustNew}/{@code opsCustDeact}/{@code opsCustReact},
 * screens-b §15) and the operator dashboard (screens-a §5.3). Every write is audited ({@code 고객사 생성},
 * {@code 고객사 비활성}, {@code 고객사 사용 재개}) and setup steps are logged.
 */
@Service
@Transactional
public class OpsCustomerService {

    static final String DEFAULT_PROJECT = "기본 프로젝트";
    static final int DEFAULT_DUE_SOON_DAYS = 3;
    static final int RECENT_AUDIT = 6;

    private final OperatorAccess operators;
    private final CustomerService customers;
    private final ProjectAccess projectAccess;
    private final ProjectAdminService projectAdmin;
    private final UserService users;
    private final SessionService sessions;
    private final RequestStatsService requestStats;
    private final DatasetService datasets;
    private final ContentTypeService contentTypes;
    private final SetupLogService setupLogs;
    private final AuditLogService audit;
    private final Clock clock;

    public OpsCustomerService(OperatorAccess operators, CustomerService customers, ProjectAccess projectAccess,
            ProjectAdminService projectAdmin, UserService users, SessionService sessions,
            RequestStatsService requestStats, DatasetService datasets, ContentTypeService contentTypes,
            SetupLogService setupLogs, AuditLogService audit, Clock clock) {
        this.operators = operators;
        this.customers = customers;
        this.projectAccess = projectAccess;
        this.projectAdmin = projectAdmin;
        this.users = users;
        this.sessions = sessions;
        this.requestStats = requestStats;
        this.datasets = datasets;
        this.contentTypes = contentTypes;
        this.setupLogs = setupLogs;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public List<OpsCustomer> list(AuthUser auth) {
        operators.require(auth);
        return rows();
    }

    /** Contract OpsDashboard (§9): KPIs and setup steps of active customers, every customer row, 6 newest audits. */
    @Transactional(readOnly = true)
    public OpsDashboard dashboard(AuthUser auth) {
        operators.require(auth);
        List<OpsCustomer> rows = rows();
        return new OpsDashboard(OpsDashboardRules.kpis(rows), OpsDashboardRules.todos(rows), rows,
                audit.all(PageQuery.of(0, RECENT_AUDIT)).content());
    }

    /** Every customer (inactive included) with its figures, in id order. */
    List<OpsCustomer> rows() {
        Map<Long, Long> projectCounts = projectAccess.projectCounts();
        Map<Long, Long> userCounts = users.countByCustomer();
        Map<Long, RequestCounts> requestCounts = requestStats.countsByCustomer();
        Map<Long, Set<ContentType>> assigned = datasets.assignedTypesByCustomer();
        List<ContentType> inUse = contentTypes.activeTypes();
        List<Customer> all = customers.all();
        Map<Long, User> creators = users.byIds(all.stream().map(Customer::getCreatedBy).filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        List<OpsCustomer> rows = new ArrayList<>();
        for (Customer c : all) {
            rows.add(row(c, creators, projectCounts, userCounts, requestCounts, assigned, inUse));
        }
        return rows;
    }

    OpsCustomer row(Customer c) {
        Map<Long, User> creators = c.getCreatedBy() == null ? Map.of() : users.byIds(Set.of(c.getCreatedBy()));
        return row(c, creators, projectAccess.projectCounts(), users.countByCustomer(),
                requestStats.countsByCustomer(), datasets.assignedTypesByCustomer(), contentTypes.activeTypes());
    }

    private OpsCustomer row(Customer c, Map<Long, User> creators, Map<Long, Long> projectCounts,
            Map<Long, Long> userCounts, Map<Long, RequestCounts> requestCounts, Map<Long, Set<ContentType>> assigned,
            List<ContentType> inUse) {
        RequestCounts counts = requestCounts.getOrDefault(c.getId(), RequestCounts.NONE);
        Set<ContentType> has = assigned.getOrDefault(c.getId(), Set.of());
        List<ContentType> unassigned = inUse.stream().filter(t -> !has.contains(t)).toList();
        User creator = c.getCreatedBy() == null ? null : creators.get(c.getCreatedBy());
        return OpsCustomer.of(c, creator == null ? null : creator.getName(),
                projectCounts.getOrDefault(c.getId(), 0L), userCounts.getOrDefault(c.getId(), 0L),
                counts.total(), counts.active(), counts.completed(), counts.sample(),
                users.activeAdminsOf(c.getId()).stream().map(UserService::summary).toList(), unassigned);
    }

    // ------------------------------------------------------------------ writes

    /**
     * New customer: name, unique normalized domain, approval use (fixed afterwards), channel {@code IN_APP}, due-soon
     * 3 days, not a sample, plus the project {@code 기본 프로젝트} without a lead. Audited {@code 고객사 생성} (and
     * {@code 프로젝트 생성}); setup log {@code 고객사 생성} and {@code 기본 프로젝트 생성}.
     */
    public OpsCustomer create(AuthUser auth, CreateCustomerBody body) {
        User operator = operators.require(auth);
        CreateCustomerBody b = body == null ? new CreateCustomerBody(null, null, null) : body;
        String name = CustomerRules.name(b.name());
        String domain = CustomerRules.domain(b.domain());
        customers.findByDomain(domain).ifPresent(existing -> {
            throw new BusinessException(ErrorCode.DUPLICATE, CustomerRules.duplicateDomain(existing.getName()));
        });
        boolean approval = Boolean.TRUE.equals(b.approvalEnabled());
        Instant now = clock.instant();
        Customer customer;
        try {
            customer = customers.create(new Customer(name, domain, approval, false, NotifyChannel.IN_APP,
                    DEFAULT_DUE_SOON_DAYS, operator.getId(), now));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.DUPLICATE, "같은 도메인의 고객사가 이미 있습니다");
        }
        Project project = projectAdmin.createForSetup(customer, DEFAULT_PROJECT, null, operator.getId());
        audit.record(operator.getId(), customer.getId(), "고객사 생성", name,
                domain + ", 승인 단계 " + (approval ? "사용" : "미사용"));
        audit.record(operator.getId(), customer.getId(), "프로젝트 생성", project.getName(), "기본 프로젝트 자동 생성, 대표 없음");
        setupLogs.record(customer.getId(), operator.getId(), "고객사 생성", name, "초기 프로젝트와 사용자, 유효 데이터셋 배정이 남았습니다");
        setupLogs.record(customer.getId(), operator.getId(), "기본 프로젝트 생성", project.getName(), "첫 고객사 관리자 초대 필요");
        return row(customer);
    }

    /**
     * Deactivation (data kept): reason required; refused while requests are in progress (submitted, not final).
     * Every session of the customer's users ends; sign-in and API calls are refused from then on. Audited
     * {@code 고객사 비활성} with the reason.
     */
    public OpsCustomer deactivate(AuthUser auth, long customerId, String rawReason) {
        User operator = operators.require(auth);
        Customer customer = customers.require(customerId);
        String reason = CustomerRules.reason(rawReason);
        if (!customer.isActive()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "이미 비활성 상태인 고객사입니다");
        }
        long inProgress = requestStats.countsOf(customer.getId()).active();
        if (inProgress > 0) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT,
                    "진행 중 요청 " + inProgress + "건을 먼저 정리하거나 담당자와 합의해야 합니다");
        }
        customer.deactivate(reason, clock.instant());
        users.byCustomer(customer.getId()).forEach(u -> sessions.revokeAllOf(u.getId()));
        audit.record(operator.getId(), customer.getId(), "고객사 비활성", customer.getName(), reason);
        return row(customer);
    }

    /** Reactivation; audited {@code 고객사 사용 재개}. */
    public OpsCustomer reactivate(AuthUser auth, long customerId) {
        User operator = operators.require(auth);
        Customer customer = customers.require(customerId);
        customer.reactivate(clock.instant());
        audit.record(operator.getId(), customer.getId(), "고객사 사용 재개", customer.getName(), null);
        return row(customer);
    }

    /** An existing customer, active or not (missing: {@code NOT_FOUND}). */
    Customer requireExisting(long customerId) {
        return customers.require(customerId);
    }

    /** An existing, active customer for a setup write (inactive: {@code REQUEST_STATE_CONFLICT}). */
    Customer requireActive(long customerId) {
        Customer customer = customers.require(customerId);
        if (!customer.isActive()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "비활성 고객사입니다. 사용 재개 후 진행하세요");
        }
        return customer;
    }
}
