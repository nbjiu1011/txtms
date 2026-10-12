package com.txtms.global.audit;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.config.AppProperties;

/**
 * The single write path for audit records. Admin/operator write actions and access/export events call
 * {@link #record}. Access and export records carry a retention deadline; everything else is kept forever.
 */
@Service
public class AuditLogService {

    /** Actions whose records expire after the configured access-log retention. */
    public static final Set<String> ACCESS_ACTIONS = Set.of("요청 조회", "파일 다운로드", "완료본 반출", "첨부 반출");

    private final AuditLogRepository repository;
    private final ActorNames actorNames;
    private final Clock clock;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final int accessRetentionYears;

    public AuditLogService(AuditLogRepository repository, ActorNames actorNames, Clock clock,
            AppProperties properties) {
        this.repository = repository;
        this.actorNames = actorNames;
        this.clock = clock;
        this.accessRetentionYears = properties.audit().retention().years();
    }

    /** Contract AuditLog (§12). {@code actorName}: the actor's current name (null for system actions). */
    public record Entry(long id, Instant at, Long actorId, String actorName, String action, Long customerId,
            String target, String detail) {
    }

    /** Records of one customer, newest first. */
    @Transactional(readOnly = true)
    public PageResponse<Entry> ofCustomer(long customerId, PageQuery page) {
        return entries(repository.findByCustomerIdOrderByAtDescIdDesc(customerId,
                PageRequest.of(page.page(), page.size())));
    }

    /** Records of every customer and the operator's global actions, newest first (operator view). */
    @Transactional(readOnly = true)
    public PageResponse<Entry> all(PageQuery page) {
        return entries(repository.findAllByOrderByAtDescIdDesc(PageRequest.of(page.page(), page.size())));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog record(Long actorId, Long customerId, String action, String target, String detail) {
        Instant now = clock.instant();
        Instant retention = ACCESS_ACTIONS.contains(action)
                ? now.atZone(KST).plusYears(accessRetentionYears).toInstant() : null;
        return repository.save(new AuditLog(now, actorId, customerId, action, target, detail, retention));
    }

    private PageResponse<Entry> entries(Page<AuditLog> page) {
        List<Long> actorIds = page.getContent().stream().map(AuditLog::getActorId).filter(Objects::nonNull)
                .distinct().toList();
        Map<Long, String> names = actorIds.isEmpty() ? Map.of() : actorNames.namesOf(actorIds);
        return PageResponse.of(page, a -> new Entry(a.getId(), a.getAt(), a.getActorId(),
                a.getActorId() == null ? null : names.get(a.getActorId()), a.getAction(), a.getCustomerId(),
                a.getTarget(), a.getDetail()));
    }
}
