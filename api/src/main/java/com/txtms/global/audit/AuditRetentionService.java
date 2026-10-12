package com.txtms.global.audit;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.config.AppProperties;

/**
 * Retention of access/export audit records ({@link AuditLogService#ACCESS_ACTIONS}): records written more than
 * {@code app.audit.retention.years} calendar years ago (KST) are deleted. Every other audit record is kept forever
 * (actions.md §8.5). Deleting the same records from backups is an operating procedure.
 */
@Service
public class AuditRetentionService {

    private static final Logger log = LoggerFactory.getLogger(AuditRetentionService.class);

    private final AuditLogRepository repository;
    private final Clock clock;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final int years;

    public AuditRetentionService(AuditLogRepository repository, Clock clock, AppProperties properties) {
        this.repository = repository;
        this.clock = clock;
        this.years = properties.audit().retention().years();
    }

    /** Deletes expired access/export records and returns how many were removed. */
    @Transactional
    public int purgeExpired() {
        Instant before = clock.instant().atZone(KST).minusYears(years).toInstant();
        int deleted = repository.deleteByActionInAndAtBefore(AuditLogService.ACCESS_ACTIONS, before);
        if (deleted > 0) {
            log.info("Deleted {} access/export audit record(s) older than {} years", deleted, years);
        }
        return deleted;
    }
}
