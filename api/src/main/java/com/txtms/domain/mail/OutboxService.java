package com.txtms.domain.mail;

import java.time.Instant;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;

/** Outbox reads (the mail stub's "발송 대기함"). */
@Service
@Transactional(readOnly = true)
public class OutboxService {

    /** Contract OutboxMail (§11). {@code status} stays {@code PENDING} until real delivery is connected. */
    public record OutboxMail(long id, String to, String subject, String body, Instant createdAt, String status) {
    }

    private final OutboundEmailRepository repository;

    public OutboxService(OutboundEmailRepository repository) {
        this.repository = repository;
    }

    /** Mails addressed to the customer's users, newest first. */
    public PageResponse<OutboxMail> ofCustomer(long customerId, PageQuery page) {
        return PageResponse.of(repository.findByCustomerIdOrderByCreatedAtDescIdDesc(customerId,
                PageRequest.of(page.page(), page.size())),
                m -> new OutboxMail(m.getId(), m.getTo(), m.getSubject(), m.getBody(), m.getCreatedAt(),
                        m.getStatus()));
    }
}
