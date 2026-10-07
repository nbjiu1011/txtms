package com.txtms.domain.notification.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.notification.dto.NotificationListResponse;
import com.txtms.domain.notification.dto.NotificationResponse;
import com.txtms.domain.notification.entity.Notification;
import com.txtms.domain.notification.repository.NotificationRepository;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

/** The user's own notifications. "Read" and "work pending" are separate states. */
@Service
public class NotificationService {

    static final int LIST_LIMIT = 100;

    private final NotificationRepository repository;
    private final RequestQueryService requests;
    private final RequestPolicy policy;
    private final UserService userService;
    private final Clock clock;

    public NotificationService(NotificationRepository repository, RequestQueryService requests, RequestPolicy policy,
            UserService userService, Clock clock) {
        this.repository = repository;
        this.requests = requests;
        this.policy = policy;
        this.userService = userService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NotificationListResponse list(AuthUser auth) {
        Actor actor = userService.actorOf(userService.require(auth.userId()));
        List<Notification> items = repository.findByUserIdOrderByCreatedAtDescIdDesc(auth.userId(),
                PageRequest.of(0, LIST_LIMIT));
        Map<String, ScopedRequest> related = requests.scopedByIds(
                items.stream().map(Notification::getRequestId).filter(Objects::nonNull).distinct().toList());
        List<NotificationResponse> responses = items.stream().map(n -> {
            ScopedRequest s = n.getRequestId() == null ? null : related.get(n.getRequestId());
            boolean pending = s != null && policy.isPendingFor(actor, s.project(), s.facts());
            return new NotificationResponse(n.getId(), n.getKind(), n.getRequestId(), n.getText(), n.getCreatedAt(),
                    n.isRead(), n.isRenotify(), pending);
        }).toList();
        return new NotificationListResponse(repository.countByUserIdAndReadAtIsNull(auth.userId()), responses);
    }

    /**
     * Creates one notification per recipient: duplicates removed, the actor never notifies themselves. Runs in the
     * caller's transaction.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void notify(java.util.Collection<Long> userIds, com.txtms.domain.notification.entity.NotificationKind kind,
            String requestId, String text, Long actorId) {
        Instant now = clock.instant();
        com.txtms.domain.request.service.ReviewRecipients.finalRecipients(userIds, actorId)
                .forEach(id -> repository.save(new Notification(id, kind, requestId,
                        text.length() > 500 ? text.substring(0, 500) : text, now, false, actorId)));
    }

    @Transactional
    public void markRead(AuthUser auth, long id) {
        Notification n = repository.findByIdAndUserId(id, auth.userId()).orElseThrow(BusinessException::notFound);
        n.markRead(clock.instant());
    }

    @Transactional
    public void markAllRead(AuthUser auth) {
        Instant now = clock.instant();
        repository.markAllRead(auth.userId(), now);
    }
}
