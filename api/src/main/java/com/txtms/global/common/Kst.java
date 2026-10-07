package com.txtms.global.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * KST calendar helpers. Storage and transport are UTC; date boundaries are KST. The deadline of a due date is
 * defined in {@code DueStatus}.
 */
public final class Kst {

    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private Kst() {
    }

    public static LocalDate dateOf(Instant instant) {
        return instant.atZone(ZONE).toLocalDate();
    }
}
