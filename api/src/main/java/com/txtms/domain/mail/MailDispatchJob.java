package com.txtms.domain.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Sends due outbox mails every 10 seconds (contract §23). Disabled with {@code app.mail.dispatch-enabled=false}
 * (integration tests call {@link MailDispatcher#dispatchDue} directly); does nothing while SMTP is not configured.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "dispatch-enabled", havingValue = "true", matchIfMissing = true)
public class MailDispatchJob {

    private static final Logger log = LoggerFactory.getLogger(MailDispatchJob.class);

    private final MailDispatcher dispatcher;

    public MailDispatchJob(MailDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Scheduled(initialDelay = 10_000, fixedDelay = 10_000)
    public void run() {
        int sent = dispatcher.dispatchDue();
        if (sent > 0) {
            log.info("Sent {} mail(s)", sent);
        }
    }
}
