package com.txtms.domain.mail;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Queues mail in the outbox table only.
 * TODO(stub): no SMTP delivery yet — mails stay PENDING in outbound_emails until a real sender is wired.
 */
@Component
public class OutboxMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(OutboxMailSender.class);

    private final OutboundEmailRepository repository;
    private final Clock clock;

    public OutboxMailSender(OutboundEmailRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    @Transactional
    public long send(MailKind kind, Long customerId, String to, String subject, String body) {
        OutboundEmail mail = repository.save(new OutboundEmail(kind, customerId, to, subject, body, clock.instant()));
        log.info("[stub] mail queued in outbox only (not delivered): subject='{}'", subject);
        return mail.getId();
    }
}
