package com.txtms.domain.mail;

import java.io.UnsupportedEncodingException;
import java.time.Clock;
import java.util.List;
import java.util.function.Consumer;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.txtms.global.config.AppProperties;

/**
 * Delivers outbox mails over SMTP (contract §23). Each mail is sent outside any transaction and its result is
 * written in a transaction of its own, so a slow SMTP server holds no database work and a crash mid-batch never
 * marks an unsent mail as sent. Delivery is off while {@code spring.mail.host} (MAIL_HOST) is empty.
 */
@Service
public class MailDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MailDispatcher.class);

    private final OutboundEmailRepository repository;
    private final ObjectProvider<JavaMailSender> senders;
    private final MailProperties properties;
    private final boolean demoMode;
    private final String host;
    private final Clock clock;
    private final TransactionTemplate tx;

    public MailDispatcher(OutboundEmailRepository repository, ObjectProvider<JavaMailSender> senders,
            MailProperties properties, AppProperties app, @Value("${spring.mail.host:}") String host, Clock clock,
            PlatformTransactionManager transactions) {
        this.repository = repository;
        this.senders = senders;
        this.properties = properties;
        this.demoMode = app.demo() != null && app.demo().enabled();
        this.host = host;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactions);
    }

    /** Whether mails are delivered at all (an SMTP host and a sender address are set). */
    public boolean configured() {
        return StringUtils.hasText(host) && StringUtils.hasText(properties.from()) && senders.getIfAvailable() != null;
    }

    /**
     * Status of a mail being queued: without SMTP every mail waits ({@code PENDING}, the former outbox-only
     * behaviour); with SMTP, a recipient the demo allow list rejects is kept as {@code SKIPPED}.
     */
    public boolean queueAsDeliverable(String to) {
        return !configured() || MailRecipientPolicy.deliverable(demoMode, properties.allowedRecipients(), to);
    }

    /** Sends the mails that are due; returns how many the SMTP server accepted. */
    public int dispatchDue() {
        if (!configured()) {
            return 0;
        }
        List<Long> due = tx.execute(status -> repository
                .findByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAscIdAsc(OutboundEmail.STATUS_PENDING,
                        clock.instant(), PageRequest.of(0, properties.batchSize()))
                .stream().map(OutboundEmail::getId).toList());
        int sent = 0;
        for (Long id : due == null ? List.<Long>of() : due) {
            if (deliver(id)) {
                sent++;
            }
        }
        return sent;
    }

    private boolean deliver(long id) {
        OutboundEmail mail = repository.findById(id).orElse(null);
        if (mail == null || !OutboundEmail.STATUS_PENDING.equals(mail.getStatus())) {
            return false;
        }
        if (!MailRecipientPolicy.deliverable(demoMode, properties.allowedRecipients(), mail.getTo())) {
            update(id, OutboundEmail::markSkipped);
            log.info("Mail {} skipped: recipient not on the demo allow list", id);
            return false;
        }
        try {
            send(mail);
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            String error = e.getClass().getSimpleName() + ": " + e.getMessage();
            update(id, m -> m.recordFailure(error, clock.instant(), properties.retryDelays()));
            log.warn("Mail {} delivery attempt failed: {}", id, error);
            return false;
        }
        update(id, m -> m.markSent(clock.instant()));
        return true;
    }

    private void send(OutboundEmail mail) throws MessagingException, UnsupportedEncodingException {
        JavaMailSender sender = senders.getObject();
        MimeMessage message = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(properties.from(), properties.fromName());
        helper.setTo(mail.getTo());
        helper.setSubject(mail.getSubject());
        helper.setText(mail.getBody(), false);
        sender.send(message);
    }

    private void update(long id, Consumer<OutboundEmail> change) {
        tx.executeWithoutResult(status -> repository.findById(id).ifPresentOrElse(change, () -> {
            throw new IllegalStateException("Mail " + id + " disappeared during delivery");
        }));
    }
}
