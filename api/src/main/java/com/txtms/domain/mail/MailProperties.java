package com.txtms.domain.mail;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Outbox delivery settings ({@code app.mail.*}, contract §23). The SMTP server itself is {@code spring.mail.*}.
 *
 * @param from              sender address (empty = the SMTP user name)
 * @param fromName          display name of the sender
 * @param allowedRecipients demo mode only: {@code @domain} or full addresses that may receive real mail
 * @param dispatchEnabled   switch of the delivery job (integration tests run it explicitly)
 * @param batchSize         mails per job run
 * @param retryDelays       delay before each retry; one more failure than delays makes the mail FAILED
 */
@ConfigurationProperties("app.mail")
public record MailProperties(
        String from,
        String fromName,
        List<String> allowedRecipients,
        boolean dispatchEnabled,
        int batchSize,
        List<Duration> retryDelays) {

    public MailProperties {
        allowedRecipients = allowedRecipients == null ? List.of() : List.copyOf(allowedRecipients);
        retryDelays = retryDelays == null ? List.of() : List.copyOf(retryDelays);
        batchSize = batchSize <= 0 ? 20 : batchSize;
    }

    /** Attempts after which a mail is FAILED (the first try plus one retry per delay). */
    public int maxAttempts() {
        return retryDelays.size() + 1;
    }
}
