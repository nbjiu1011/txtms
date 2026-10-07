package com.txtms.domain.correction.service;

import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.correction.dto.DatasetDtos.AssignmentResponse;
import com.txtms.domain.correction.dto.DatasetDtos.DatasetDetailResponse;
import com.txtms.domain.correction.dto.DatasetDtos.DatasetResponse;
import com.txtms.domain.correction.dto.DatasetDtos.RuleDto;
import com.txtms.domain.correction.engine.CorrectionEngine;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.correction.entity.Dataset;
import com.txtms.domain.correction.entity.DatasetAssignment;
import com.txtms.domain.correction.entity.DatasetRule;
import com.txtms.domain.correction.entity.DatasetScope;
import com.txtms.domain.correction.repository.DatasetAssignmentRepository;
import com.txtms.domain.correction.repository.DatasetRepository;
import com.txtms.domain.correction.repository.DatasetRuleRepository;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Correction datasets (immutable versions per scope) and the effective dataset of each customer × content type.
 * Operator endpoints (contract §12) are audited; the request side asks {@link #effective} for the engine of a request.
 */
@Service
@Transactional
public class DatasetService {

    static final String OPERATOR_REQUIRED = "운영 담당자 권한이 필요합니다";
    static final String COMMON_PHASE2 = "공통 데이터셋은 Phase 2입니다. 콘텐츠 유형별 데이터셋을 사용하세요";

    /** The dataset a request is checked with. */
    public record EffectiveDataset(long datasetId, String label, CorrectionEngine engine) {
    }

    private final DatasetRepository datasets;
    private final DatasetRuleRepository rules;
    private final DatasetAssignmentRepository assignments;
    private final CustomerService customers;
    private final UserService users;
    private final AuditLogService audit;
    private final Clock clock;
    private final AppProperties.Correction settings;
    /** Compiled engines by dataset id. Dataset versions never change, so entries never go stale. */
    private final Map<Long, CorrectionEngine> engines = new ConcurrentHashMap<>();

    public DatasetService(DatasetRepository datasets, DatasetRuleRepository rules,
            DatasetAssignmentRepository assignments, CustomerService customers, UserService users,
            AuditLogService audit, Clock clock, AppProperties properties) {
        this.datasets = datasets;
        this.rules = rules;
        this.assignments = assignments;
        this.customers = customers;
        this.users = users;
        this.audit = audit;
        this.clock = clock;
        this.settings = properties.correction();
    }

    // ------------------------------------------------------------------ request side

    /** The assigned dataset of the customer and type with its compiled engine, or empty when none is assigned. */
    @Transactional(readOnly = true)
    public Optional<EffectiveDataset> effective(long customerId, ContentType type) {
        return assignments.findByCustomerIdAndType(customerId, DatasetScope.of(type))
                .flatMap(a -> datasets.findById(a.getDatasetId()))
                .map(d -> new EffectiveDataset(d.getId(), d.label(), engine(d.getId())));
    }

    /** Label of the assigned dataset ({@code 알림톡 v3}), or empty. */
    @Transactional(readOnly = true)
    public Optional<String> effectiveLabel(long customerId, ContentType type) {
        return assignments.findByCustomerIdAndType(customerId, DatasetScope.of(type))
                .flatMap(a -> datasets.findById(a.getDatasetId()))
                .map(Dataset::label);
    }

    private CorrectionEngine engine(long datasetId) {
        CorrectionEngine cached = engines.get(datasetId);
        if (cached != null) {
            return cached;
        }
        if (engines.size() > 256) {
            engines.clear();
        }
        CorrectionEngine engine = CorrectionEngine.compile(rulesOf(datasetId), ruleTimeout());
        engines.put(datasetId, engine);
        return engine;
    }

    private Duration ruleTimeout() {
        return settings == null || settings.ruleTimeout() == null ? Duration.ofMillis(200) : settings.ruleTimeout();
    }

    private List<CorrectionRule> rulesOf(long datasetId) {
        return rules.findByDatasetIdOrderBySortOrderAsc(datasetId).stream().map(DatasetRule::toRule).toList();
    }

    // ------------------------------------------------------------------ datasets (operator)

    @Transactional(readOnly = true)
    public List<DatasetResponse> list(AuthUser auth) {
        requireOperator(auth);
        Map<Long, Integer> counts = ruleCounts();
        return datasets.findAll().stream()
                .sorted(Comparator.comparing(Dataset::getScope).thenComparing(Dataset::getVersion,
                        Comparator.reverseOrder()))
                .map(d -> response(d, counts.getOrDefault(d.getId(), 0)))
                .toList();
    }

    @Transactional(readOnly = true)
    public DatasetDetailResponse detail(AuthUser auth, long id) {
        requireOperator(auth);
        Dataset d = datasets.findById(id).orElseThrow(BusinessException::notFound);
        List<RuleDto> rs = rulesOf(id).stream().map(RuleDto::of).toList();
        return new DatasetDetailResponse(response(d, rs.size()), rs);
    }

    /** JSON registration ({@code rules} in the seven engine columns); row numbers in errors are 1-based. */
    public DatasetResponse create(AuthUser auth, String scope, List<RuleDto> input) {
        User operator = requireOperator(auth);
        DatasetScope s = scopeOf(scope);
        List<DatasetRuleValidator.Row> rows = new ArrayList<>();
        if (input != null) {
            for (int i = 0; i < input.size(); i++) {
                RuleDto r = input.get(i);
                if (r == null) {
                    throw BusinessException.validation("rules." + i, (i + 1) + "행: 규칙 형식을 확인하세요");
                }
                rows.add(new DatasetRuleValidator.Row(i + 1, r.ruleId(), r.originalExpr(), r.recommendedExpr(),
                        r.originalPattern(), r.recommendedPattern(), r.descriptionLabel(), r.description()));
            }
        }
        return store(operator, s, DatasetRuleValidator.validate(rows, maxRules()));
    }

    /** XLSX registration (first sheet, seven-column header in row 1); row numbers in errors are sheet rows. */
    public DatasetResponse createFromXlsx(AuthUser auth, String scope, MultipartFile file) {
        User operator = requireOperator(auth);
        DatasetScope s = scopeOf(scope);
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.FILE_REJECTED, "파일을 선택하세요");
        }
        if (settings != null && settings.maxFileSize() != null && file.getSize() > settings.maxFileSize().toBytes()) {
            throw new BusinessException(ErrorCode.FILE_REJECTED,
                    "XLSX 최대 " + settings.maxFileSize().toMegabytes() + "MB");
        }
        List<DatasetRuleValidator.Row> rows;
        try (InputStream in = file.getInputStream()) {
            rows = DatasetXlsxReader.read(in, maxRules());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_REJECTED, "파일을 읽지 못했습니다. XLSX 형식인지 확인하세요");
        }
        return store(operator, s, DatasetRuleValidator.validate(rows, maxRules()));
    }

    private DatasetResponse store(User operator, DatasetScope scope, List<CorrectionRule> validated) {
        Dataset d = createVersion(scope, validated, operator.getId());
        audit.record(operator.getId(), null, "교정 데이터셋 시드 등록", d.label(), validated.size() + "개 규칙");
        return response(d, validated.size());
    }

    /**
     * Stores {@code validated} rules as the next version of the scope. Also used by the demo seed (no audit).
     * Two registrations of the same scope at once collide on the unique (scope, version) key: the later one fails
     * with {@code DUPLICATE} and can simply be sent again.
     */
    public Dataset createVersion(DatasetScope scope, List<CorrectionRule> validated, Long createdBy) {
        Dataset d;
        try {
            d = datasets.saveAndFlush(new Dataset(scope, datasets.maxVersion(scope) + 1, clock.instant(), createdBy));
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.DUPLICATE, "같은 범위의 데이터셋이 동시에 등록되었습니다. 다시 등록하세요");
        }
        int order = 0;
        List<DatasetRule> rows = new ArrayList<>(validated.size());
        for (CorrectionRule r : validated) {
            rows.add(new DatasetRule(d.getId(), order++, r));
        }
        rules.saveAll(rows);
        return d;
    }

    /** Rules of a stored dataset version (demo refresh compares them with the seed). */
    @Transactional(readOnly = true)
    public List<CorrectionRule> rules(long datasetId) {
        return rulesOf(datasetId);
    }

    @Transactional(readOnly = true)
    public Optional<Dataset> latest(DatasetScope scope) {
        return datasets.findFirstByScopeOrderByVersionDesc(scope);
    }

    @Transactional(readOnly = true)
    public Optional<DatasetAssignment> findAssignment(long customerId, DatasetScope scope) {
        return assignments.findByCustomerIdAndType(customerId, scope);
    }

    /** Assigned content types per customer id (operator overview: unassigned combinations). */
    @Transactional(readOnly = true)
    public Map<Long, java.util.Set<ContentType>> assignedTypesByCustomer() {
        Map<Long, java.util.Set<ContentType>> result = new HashMap<>();
        for (DatasetAssignment a : assignments.findAll()) {
            if (a.getType() == DatasetScope.COMMON) {
                continue;
            }
            result.computeIfAbsent(a.getCustomerId(), k -> java.util.EnumSet.noneOf(ContentType.class))
                    .add(ContentType.valueOf(a.getType().name()));
        }
        return result;
    }

    // ------------------------------------------------------------------ assignments (operator)

    @Transactional(readOnly = true)
    public List<AssignmentResponse> assignments(AuthUser auth) {
        requireOperator(auth);
        List<DatasetAssignment> all = assignments.findAllByOrderByCustomerIdAscIdAsc().stream()
                .sorted(Comparator.comparing(DatasetAssignment::getCustomerId)
                        .thenComparing(DatasetAssignment::getType))
                .toList();
        Set<Long> actorIds = new HashSet<>();
        for (DatasetAssignment a : all) {
            if (a.getAssignedBy() != null) {
                actorIds.add(a.getAssignedBy());
            }
            if (a.getCheckedBy() != null) {
                actorIds.add(a.getCheckedBy());
            }
        }
        Map<Long, User> actors = users.byIds(actorIds);
        return all.stream().map(a -> response(a, actors)).toList();
    }

    /** Assigns or changes the effective dataset of the customer × type (a change clears the confirmation). */
    public AssignmentResponse assign(AuthUser auth, long customerId, String type, Long datasetId) {
        User operator = requireOperator(auth);
        Customer customer = customers.find(customerId).orElseThrow(BusinessException::notFound);
        ContentType t = typeOf(type);
        if (datasetId == null) {
            throw BusinessException.validation("datasetId", "데이터셋을 선택하세요");
        }
        Dataset d = datasets.findById(datasetId)
                .orElseThrow(() -> BusinessException.validation("datasetId", "등록되지 않은 데이터셋입니다"));
        if (d.getScope() != DatasetScope.of(t)) {
            throw BusinessException.validation("datasetId", ContentTypeService.label(t) + " 데이터셋만 배정할 수 있습니다");
        }
        return response(assign(operator.getId(), customer.getId(), d));
    }

    /**
     * Assignment write shared with the demo refresh ({@code actorId} may be null there). Audited as
     * {@code 유효 데이터셋 배정} / {@code 유효 데이터셋 변경}; the same dataset again changes nothing.
     */
    public DatasetAssignment assign(Long actorId, long customerId, Dataset dataset) {
        Instant now = clock.instant();
        DatasetScope type = dataset.getScope();
        Optional<DatasetAssignment> current = assignments.findByCustomerIdAndType(customerId, type);
        if (current.isPresent()) {
            DatasetAssignment a = current.get();
            if (a.getDatasetId().equals(dataset.getId())) {
                return a;
            }
            int before = datasets.findById(a.getDatasetId()).map(Dataset::getVersion).orElse(0);
            a.change(dataset.getId(), now, actorId);
            audit.record(actorId, customerId, "유효 데이터셋 변경", type.label(),
                    "v" + before + " → v" + dataset.getVersion());
            return a;
        }
        DatasetAssignment a = assignments.save(new DatasetAssignment(customerId, type, dataset.getId(), now,
                actorId));
        audit.record(actorId, customerId, "유효 데이터셋 배정", type.label(),
                "v" + dataset.getVersion());
        return a;
    }

    public void unassign(AuthUser auth, long customerId, String type) {
        User operator = requireOperator(auth);
        customers.find(customerId).orElseThrow(BusinessException::notFound);
        unassign(operator.getId(), customerId, DatasetScope.of(typeOf(type)));
    }

    /** Removes the assignment (audited {@code 유효 데이터셋 해제}); NOT_FOUND when there is none. */
    public void unassign(Long actorId, long customerId, DatasetScope type) {
        DatasetAssignment a = assignments.findByCustomerIdAndType(customerId, type)
                .orElseThrow(BusinessException::notFound);
        int version = datasets.findById(a.getDatasetId()).map(Dataset::getVersion).orElse(0);
        assignments.delete(a);
        audit.record(actorId, customerId, "유효 데이터셋 해제", type.label(), "v" + version);
    }

    /** Operator confirmation of the current assignment (audited {@code 유효 데이터셋 확인}). */
    public AssignmentResponse confirm(AuthUser auth, long customerId, String type) {
        User operator = requireOperator(auth);
        customers.find(customerId).orElseThrow(BusinessException::notFound);
        return response(confirm(operator.getId(), customerId, DatasetScope.of(typeOf(type))));
    }

    public DatasetAssignment confirm(Long actorId, long customerId, DatasetScope type) {
        DatasetAssignment a = assignments.findByCustomerIdAndType(customerId, type)
                .orElseThrow(BusinessException::notFound);
        a.confirm(clock.instant(), actorId);
        int version = datasets.findById(a.getDatasetId()).map(Dataset::getVersion).orElse(0);
        audit.record(actorId, customerId, "유효 데이터셋 확인", type.label(), "v" + version);
        return a;
    }

    // ------------------------------------------------------------------ helpers

    private User requireOperator(AuthUser auth) {
        User user = users.require(auth.userId());
        if (!user.isOperator() || !users.canUseAccount(user)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, OPERATOR_REQUIRED);
        }
        return user;
    }

    private int maxRules() {
        return settings == null || settings.maxRules() <= 0 ? 5000 : settings.maxRules();
    }

    private static DatasetScope scopeOf(String scope) {
        if (scope == null || scope.isBlank()) {
            throw BusinessException.validation("scope", "적용 범위를 선택하세요");
        }
        DatasetScope s;
        try {
            s = DatasetScope.valueOf(scope.trim());
        } catch (IllegalArgumentException e) {
            throw BusinessException.validation("scope", "적용 범위를 확인하세요");
        }
        if (s == DatasetScope.COMMON) {
            throw BusinessException.validation("scope", COMMON_PHASE2);
        }
        return s;
    }

    /** Path type of an assignment: a content type; {@code COMMON} is Phase 2, anything else is not a resource. */
    private static ContentType typeOf(String type) {
        if (DatasetScope.COMMON.name().equals(type)) {
            throw BusinessException.validation("type", COMMON_PHASE2);
        }
        try {
            return ContentType.valueOf(type);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw BusinessException.notFound();
        }
    }

    private Map<Long, Integer> ruleCounts() {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : rules.countByDataset()) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }
        return counts;
    }

    private static DatasetResponse response(Dataset d, int ruleCount) {
        return new DatasetResponse(d.getId(), d.getScope(), d.getVersion(), ruleCount, d.getCreatedAt(),
                d.getCreatedBy());
    }

    private AssignmentResponse response(DatasetAssignment a) {
        Set<Long> actorIds = new HashSet<>();
        if (a.getAssignedBy() != null) {
            actorIds.add(a.getAssignedBy());
        }
        if (a.getCheckedBy() != null) {
            actorIds.add(a.getCheckedBy());
        }
        return response(a, users.byIds(actorIds));
    }

    /** {@code assignedByName}/{@code checkedByName}: the operators' current names (null when unknown). */
    private static AssignmentResponse response(DatasetAssignment a, Map<Long, User> actors) {
        return new AssignmentResponse(a.getCustomerId(), a.getType(), a.getDatasetId(), a.getAssignedAt(),
                a.getAssignedBy(), nameOf(actors, a.getAssignedBy()), a.getCheckedAt(), a.getCheckedBy(),
                nameOf(actors, a.getCheckedBy()));
    }

    private static String nameOf(Map<Long, User> actors, Long id) {
        User user = id == null ? null : actors.get(id);
        return user == null ? null : user.getName();
    }
}
