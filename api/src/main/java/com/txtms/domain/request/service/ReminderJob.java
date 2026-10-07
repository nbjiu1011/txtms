package com.txtms.domain.request.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the re-notification rules every minute (prototype interval). Disabled with
 * {@code app.reminder.job-enabled=false} (integration tests call {@link ReminderService#run} directly).
 */
@Component
@ConditionalOnProperty(prefix = "app.reminder", name = "job-enabled", havingValue = "true", matchIfMissing = true)
public class ReminderJob {

    private static final Logger log = LoggerFactory.getLogger(ReminderJob.class);

    private final ReminderService reminders;

    public ReminderJob(ReminderService reminders) {
        this.reminders = reminders;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    public void run() {
        int sent = reminders.run();
        if (sent > 0) {
            log.info("Sent {} re-notification(s)", sent);
        }
    }
}
