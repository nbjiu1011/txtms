package com.txtms.domain.mail;

/**
 * A rendered mail ({@link MailTemplates}): the plain-text part is what the outbox shows; the HTML part (may be null)
 * is only used for delivery.
 */
public record MailContent(String subject, String text, String html) {
}
