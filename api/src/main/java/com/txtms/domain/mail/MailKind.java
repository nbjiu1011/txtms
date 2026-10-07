package com.txtms.domain.mail;

/** What an outbox mail is for; set by the sender when the mail is queued. */
public enum MailKind {
    INVITATION,
    PASSWORD_RESET,
    REMINDER,
    OTHER
}
