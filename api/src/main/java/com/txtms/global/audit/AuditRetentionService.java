package com.txtms.global.audit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.config.AppProperties;

/**
 * Retention of access/export audit records ({@link AuditLogService#ACCESS_ACTIONS}): records older than
 * {@code app.audit.retention.days} are deleted. Every other audit record is kept forever (actions.md §8.5).
 */
@Service
public class AuditRetentionService {

    private static final Logger log = LoggerFactory.getLogger(AuditRetentionService.class);

    private final AuditLogRepository repository;
    private final Clock clock;
    private final int days;

    public AuditRetentionService(AuditLogRepository repository, Clock clock, AppProperties properties) {
        this.repository = repository;
        this.clock = clock;
        this.days = properties.audit().retention().days();
    }

    /** Deletes expired access/export records and returns how many were removed. */
    @Transactional
    public int purgeExpired() {
        Instant before = clock.instant().minus(Duration.ofDays(days));
        int deleted = repository.deleteByActionInAndAtBefore(AuditLogService.ACCESS_ACTIONS, before);
        if (deleted > 0) {
            log.info("Deleted {} access/export audit record(s) older than {} days", deleted, days);
        }
        return deleted;
    }
}
