package com.txtms.domain.mail;

import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;

/** Outbox reads ("발송 대기함", with delivery status). Token links are masked unless the caller may see them. */
@Service
@Transactional(readOnly = true)
public class OutboxService {

    /**
     * Contract OutboxMail (§11, §12). {@code status}: {@code PENDING} · {@code SENT} · {@code FAILED} ·
     * {@code SKIPPED}, {@code sentAt}: when the SMTP server accepted it (§23); {@code masked}: an invitation or reset link in {@code body} was hidden ({@link OutboxMasking}); {@code kind}:
     * what the mail is for.
     */
    public record OutboxMail(long id, Long customerId, String to, String subject, String body, Instant createdAt,
            String status, Instant sentAt, boolean masked, MailKind kind) {
    }

    private final OutboundEmailRepository repository;

    public OutboxService(OutboundEmailRepository repository) {
        this.repository = repository;
    }

    /** Mails addressed to the customer's users, newest first. */
    public PageResponse<OutboxMail> ofCustomer(long customerId, PageQuery page, boolean reveal) {
        return map(repository.findByCustomerIdOrderByCreatedAtDescIdDesc(customerId,
                PageRequest.of(page.page(), page.size())), reveal);
    }

    /** Every queued mail (operator), newest first. */
    public PageResponse<OutboxMail> all(PageQuery page, boolean reveal) {
        return map(repository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(page.page(), page.size())), reveal);
    }

    private static PageResponse<OutboxMail> map(Page<OutboundEmail> page, boolean reveal) {
        return PageResponse.of(page, m -> {
            OutboxMasking.Shown shown = OutboxMasking.show(m.getBody(), reveal);
            return new OutboxMail(m.getId(), m.getCustomerId(), m.getTo(), m.getSubject(), shown.body(),
                    m.getCreatedAt(), m.getStatus(), m.getSentAt(), shown.masked(), m.getKind());
        });
    }
}
