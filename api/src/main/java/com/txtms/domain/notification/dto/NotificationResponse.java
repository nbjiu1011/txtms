package com.txtms.domain.notification.dto;

import java.time.Instant;

import com.txtms.domain.notification.entity.NotificationKind;

/** Contract Notification (§10). {@code pending}: the user still has work to do on the request. */
public record NotificationResponse(
        long id,
        NotificationKind kind,
        String requestId,
        String text,
        Instant createdAt,
        boolean read,
        boolean renotify,
        boolean pending) {
}
