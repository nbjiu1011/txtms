package com.txtms.domain.notification.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.notification.dto.NotificationListResponse;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    /** Latest 100 notifications of the current user. */
    @GetMapping
    public NotificationListResponse list(@AuthenticationPrincipal AuthUser auth) {
        return notifications.list(auth);
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        notifications.markRead(auth, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthUser auth) {
        notifications.markAllRead(auth);
        return ResponseEntity.noContent().build();
    }
}
