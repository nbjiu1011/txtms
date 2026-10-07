package com.txtms.global.audit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

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
    private final Clock clock;
    private final int accessRetentionDays;

    public AuditLogService(AuditLogRepository repository, Clock clock, AppProperties properties) {
        this.repository = repository;
        this.clock = clock;
        this.accessRetentionDays = properties.audit().retention().days();
    }

    /** Contract AuditLog (§12). */
    public record Entry(long id, Instant at, Long actorId, String action, Long customerId, String target,
            String detail) {
    }

    /** Records of one customer, newest first. */
    @Transactional(readOnly = true)
    public PageResponse<Entry> ofCustomer(long customerId, PageQuery page) {
        return PageResponse.of(repository.findByCustomerIdOrderByAtDescIdDesc(customerId,
                PageRequest.of(page.page(), page.size())),
                a -> new Entry(a.getId(), a.getAt(), a.getActorId(), a.getAction(), a.getCustomerId(), a.getTarget(),
                        a.getDetail()));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog record(Long actorId, Long customerId, String action, String target, String detail) {
        Instant now = clock.instant();
        Instant retention = ACCESS_ACTIONS.contains(action) ? now.plus(Duration.ofDays(accessRetentionDays)) : null;
        return repository.save(new AuditLog(now, actorId, customerId, action, target, detail, retention));
    }
}
