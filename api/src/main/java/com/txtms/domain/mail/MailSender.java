package com.txtms.domain.mail;

/** Outgoing mail port. */
public interface MailSender {

    void send(Long customerId, String to, String subject, String body);
}
