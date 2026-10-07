package com.txtms.domain.request.service;

import java.time.Instant;

/**
 * Draft autosave conflict rule (contract §4 {@code expectedSavedAt}): key absent → no check; explicit null → the
 * client expects the content was never saved, so any stored {@code savedAt} conflicts; a value → conflict when the
 * stored {@code savedAt} is newer.
 */
public final class SaveConflicts {

    private SaveConflicts() {
    }

    public static boolean conflicts(boolean expectedPresent, Instant expected, Instant stored) {
        if (!expectedPresent || stored == null) {
            return false;
        }
        return expected == null || stored.isAfter(expected);
    }
}
