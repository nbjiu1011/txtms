package com.txtms.domain.ops.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.demo.DemoDataSeeder;
import com.txtms.domain.ops.dto.OpsDtos.SampleOverview;
import com.txtms.domain.ops.dto.OpsDtos.SampleRequestBody;
import com.txtms.domain.ops.dto.OpsDtos.SampleResetResult;
import com.txtms.domain.request.dto.response.SampleRequestSummary;
import com.txtms.domain.request.service.RequestStatsService;
import com.txtms.domain.request.service.SampleRequestService;
import com.txtms.domain.user.entity.User;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

import jakarta.persistence.EntityManager;

/**
 * Sample data of the operator (actions.md §2.14 {@code seedSample}/{@code seedClear}/{@code reset}, screens-b §16).
 * Only sample customers are ever touched: creating and clearing samples refuse other customers, and the reset
 * selects sample customers only (it fails before any change when a seed request id exists elsewhere).
 */
@Service
@Transactional
public class OpsSampleService {

    static final String SAMPLE_ONLY = "샘플 데이터 작업은 샘플 고객사에서만 가능합니다";

    private final OperatorAccess operators;
    private final OpsCustomerService opsCustomers;
    private final CustomerService customers;
    private final SampleRequestService samples;
    private final RequestStatsService requestStats;
    private final DemoDataSeeder demoSeeder;
    private final SetupLogService setupLogs;
    private final AuditLogService audit;
    private final EntityManager entityManager;

    public OpsSampleService(OperatorAccess operators, OpsCustomerService opsCustomers, CustomerService customers,
            SampleRequestService samples, RequestStatsService requestStats, DemoDataSeeder demoSeeder,
            SetupLogService setupLogs, AuditLogService audit, EntityManager entityManager) {
        this.operators = operators;
        this.opsCustomers = opsCustomers;
        this.customers = customers;
        this.samples = samples;
        this.requestStats = requestStats;
        this.demoSeeder = demoSeeder;
        this.setupLogs = setupLogs;
        this.audit = audit;
        this.entityManager = entityManager;
    }

    /** Sample requests of the customer and the number of real requests a cleanup keeps (counts only). */
    @Transactional(readOnly = true)
    public SampleOverview overview(AuthUser auth, long customerId) {
        operators.require(auth);
        Customer customer = customers.require(customerId);
        List<SampleRequestSummary> list = samples.samplesOf(customer.getId());
        long total = requestStats.countsOf(customer.getId()).total();
        return new SampleOverview(customer.getId(), customer.isSample(), list, total - list.size());
    }

    /** One draft sample request; setup log {@code 샘플 요청 생성}, audit {@code 샘플 요청 생성}. */
    public SampleRequestSummary create(AuthUser auth, long customerId, SampleRequestBody body) {
        User operator = operators.require(auth);
        Customer customer = sampleCustomer(customerId);
        opsCustomers.requireActive(customerId);
        SampleRequestBody b = body == null ? new SampleRequestBody(null, null) : body;
        SampleRequestSummary created = samples.create(customer, b.projectId(), b.type(), operator.getId());
        String what = ContentTypeService.label(created.type()) + ", 작성 중";
        setupLogs.record(customer.getId(), operator.getId(), "샘플 요청 생성", created.id(), what);
        audit.record(operator.getId(), customer.getId(), "샘플 요청 생성", created.id(), what);
        return created;
    }

    /**
     * Removes the customer's sample requests with every child row (real requests, their bundles and history stay).
     * Audited {@code 샘플 데이터 초기화}; setup log {@code 샘플 초기화}.
     */
    public void clear(AuthUser auth, long customerId) {
        User operator = operators.require(auth);
        Customer customer = sampleCustomer(customerId);
        List<String> ids = samples.requestIdsOf(List.of(customer.getId()), true);
        int removed = samples.purge(ids);
        long kept = requestStats.countsOf(customer.getId()).total();
        audit.record(operator.getId(), customer.getId(), "샘플 데이터 초기화", customer.getName(),
                "샘플 " + removed + "건 삭제, 운영 데이터 보존");
        setupLogs.record(customer.getId(), operator.getId(), "샘플 초기화", removed + "건",
                "운영 요청 " + kept + "건은 보존");
    }

    /**
     * Restores every sample customer's requests to the demo seed: all requests of sample customers are removed and
     * the seed customers among them (한빛카드, 도담생명) get the seed requests back ({@link DemoDataSeeder}). Other
     * customers are never selected. One transaction: a failure leaves everything as it was. Audited
     * {@code 샘플 초기화}; setup log per customer.
     */
    public SampleResetResult reset(AuthUser auth) {
        User operator = operators.require(auth, OperatorAccess.RESET_REQUIRED);
        List<Customer> sampleCustomers = customers.all().stream().filter(Customer::isSample).toList();
        if (sampleCustomers.isEmpty()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "샘플 고객사가 없습니다");
        }
        List<Long> ids = sampleCustomers.stream().map(Customer::getId).toList();
        Map<String, Long> seedCustomers = demoSeeder.seedCustomersAmong(ids);
        List<String> outside = samples.existingOutside(DemoDataSeeder.seedRequestIdsOf(seedCustomers.keySet()), ids);
        if (!outside.isEmpty()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT,
                    "시드 요청 ID가 다른 고객사에 있어 초기화할 수 없습니다", null, outside);
        }
        int deleted = 0;
        List<String> names = new ArrayList<>();
        Map<Long, Integer> deletedBy = new java.util.HashMap<>();
        for (Customer c : sampleCustomers) {
            int n = samples.purge(samples.requestIdsOf(List.of(c.getId()), false));
            deletedBy.put(c.getId(), n);
            deleted += n;
            names.add(c.getName());
        }
        entityManager.flush();
        entityManager.clear();
        int restored = demoSeeder.reseedSampleRequests(ids);
        for (Customer c : sampleCustomers) {
            String key = seedCustomers.entrySet().stream().filter(e -> e.getValue().equals(c.getId()))
                    .map(Map.Entry::getKey).findFirst().orElse(null);
            int back = key == null ? 0 : DemoDataSeeder.seedRequestIdsOf(List.of(key)).size();
            setupLogs.record(c.getId(), operator.getId(), "샘플 초기화", c.getName(),
                    "요청 " + deletedBy.get(c.getId()) + "건 삭제, 시드 요청 " + back + "건 복원");
        }
        audit.record(operator.getId(), null, "샘플 초기화", String.join(", ", names),
                "요청 " + deleted + "건 삭제, 시드 요청 " + restored + "건 복원, 실제 고객사 보존");
        return new SampleResetResult(ids, deleted, restored);
    }

    private Customer sampleCustomer(long customerId) {
        Customer customer = customers.require(customerId);
        if (!customer.isSample()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, SAMPLE_ONLY);
        }
        return customer;
    }
}
