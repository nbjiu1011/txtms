package com.txtms.domain.request.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Releases idle content edit locks every minute (history {@code 편집 잠금 자동 해제}). Reads already treat an expired
 * lock as free; this job writes the history entry and clears the row. Disabled with
 * {@code app.lock.release-job-enabled=false} (integration tests call {@link ContentLockService#releaseExpired}).
 */
@Component
@ConditionalOnProperty(prefix = "app.lock", name = "release-job-enabled", havingValue = "true", matchIfMissing = true)
public class LockExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(LockExpiryJob.class);

    private final ContentLockService locks;

    public LockExpiryJob(ContentLockService locks) {
        this.locks = locks;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    public void run() {
        int released = locks.releaseExpired();
        if (released > 0) {
            log.info("Released {} idle content lock(s)", released);
        }
    }
}
