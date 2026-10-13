package com.txtms.domain.mail;

import java.util.List;
import java.util.Locale;

/**
 * Who may receive real mail (pure, contract §23). Outside demo mode everyone. In demo mode (the dev server) only
 * recipients on the allow list — {@code @domain} entries match the domain, other entries the whole address, both
 * case-insensitive — because the seeded accounts use real-looking company addresses. An empty list sends nothing.
 */
public final class MailRecipientPolicy {

    private MailRecipientPolicy() {
    }

    public static boolean deliverable(boolean demoMode, List<String> allowList, String to) {
        if (!demoMode) {
            return true;
        }
        if (to == null || to.isBlank()) {
            return false;
        }
        String address = to.trim().toLowerCase(Locale.ROOT);
        for (String raw : allowList) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String entry = raw.trim().toLowerCase(Locale.ROOT);
            if (entry.startsWith("@") ? address.endsWith(entry) : address.equals(entry)) {
                return true;
            }
        }
        return false;
    }
}
