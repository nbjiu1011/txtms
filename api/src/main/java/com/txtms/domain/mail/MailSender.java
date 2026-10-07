package com.txtms.domain.mail;

/** Outgoing mail port. */
public interface MailSender {

    /** Queues the mail and returns its outbox id. */
    long send(MailKind kind, Long customerId, String to, String subject, String body);
}
