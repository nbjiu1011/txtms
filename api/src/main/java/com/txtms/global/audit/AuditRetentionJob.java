package com.txtms.global.audit;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily retention run (KST cron {@code app.audit.retention.cron}); on by default since the 3-year period was agreed
 * (2026-10-08), switch off with {@code app.audit.retention.enabled=false}.
 */
@Component
@ConditionalOnProperty(prefix = "app.audit.retention", name = "enabled", havingValue = "true")
public class AuditRetentionJob {

    private final AuditRetentionService retention;

    public AuditRetentionJob(AuditRetentionService retention) {
        this.retention = retention;
    }

    @Scheduled(cron = "${app.audit.retention.cron:0 30 3 * * *}", zone = "Asia/Seoul")
    public void run() {
        retention.purgeExpired();
    }
}
