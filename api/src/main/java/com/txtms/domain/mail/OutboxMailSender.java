package com.txtms.domain.mail;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Queues mail in the outbox (in the caller's transaction, so it exists only if the business change commits);
 * {@link MailDispatcher} delivers it over SMTP (contract §23). A recipient the demo allow list rejects is kept as
 * {@code SKIPPED}. Without SMTP settings the mail stays {@code PENDING} in the outbox only.
 */
@Component
public class OutboxMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(OutboxMailSender.class);

    private final OutboundEmailRepository repository;
    private final MailDispatcher dispatcher;
    private final Clock clock;

    public OutboxMailSender(OutboundEmailRepository repository, MailDispatcher dispatcher, Clock clock) {
        this.repository = repository;
        this.dispatcher = dispatcher;
        this.clock = clock;
    }

    @Override
    @Transactional
    public long send(MailKind kind, Long customerId, String to, MailContent content) {
        OutboundEmail mail = repository.save(new OutboundEmail(kind, customerId, to, content, clock.instant(),
                dispatcher.queueAsDeliverable(to)));
        if (!dispatcher.configured()) {
            log.info("[stub] SMTP not configured (MAIL_HOST empty): mail {} kept in the outbox only", mail.getId());
        }
        return mail.getId();
    }
}
