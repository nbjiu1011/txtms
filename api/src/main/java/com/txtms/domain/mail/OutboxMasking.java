package com.txtms.domain.mail;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hides account tokens in outbox listings (pure). Invitation, password reset and email change mails carry a usable
 * link ({@code {web}/invite/{token}}, {@code {web}/reset/{token}}, {@code {web}/email-change/{token}}); anyone who can
 * read the outbox could take over the account with it, so listings show {@code …/invite/••••} plus {@link #NOTE}. The stored mail keeps the full body
 * for delivery.
 * <p>
 * Who sees full links: a customer admin only in demo mode for a sample customer (the demo invitation flow), the
 * operator only in demo mode. Everyone else sees masked links.
 */
public final class OutboxMasking {

    public static final String MASK = "••••";
    public static final String NOTE = "링크는 수신자에게만 전달됩니다";

    private static final Pattern TOKEN_LINK = Pattern.compile("/(invite|reset|email-change)/[A-Za-z0-9_-]+");

    private OutboxMasking() {
    }

    /** A listed body and whether a link in it was hidden. */
    public record Shown(String body, boolean masked) {
    }

    /** Whether a customer admin may see full links of the customer's mails. */
    public static boolean revealForCustomerAdmin(boolean demoMode, boolean sampleCustomer) {
        return demoMode && sampleCustomer;
    }

    /** Whether the operator may see full links (every customer's mails). */
    public static boolean revealForOperator(boolean demoMode) {
        return demoMode;
    }

    public static Shown show(String body, boolean reveal) {
        if (reveal || body == null) {
            return new Shown(body, false);
        }
        Matcher m = TOKEN_LINK.matcher(body);
        if (!m.find()) {
            return new Shown(body, false);
        }
        String masked = m.replaceAll("/$1/" + MASK);
        return new Shown(masked + "\n" + NOTE, true);
    }
}
