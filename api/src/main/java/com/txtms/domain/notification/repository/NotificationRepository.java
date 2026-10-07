package com.txtms.domain.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.notification.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    long countByUserIdAndReadAtIsNull(Long userId);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    /**
     * Newest original (not re-notification) notification per request and recipient, for requests still in progress
     * and recipients other than the notification's actor. Rows of {@code [requestId, userId, notificationId]}.
     */
    @Query(value = "SELECT n.request_id, n.user_id, MAX(n.id) FROM notifications n "
            + "JOIN requests r ON r.id = n.request_id "
            + "WHERE n.renotify = FALSE AND r.status IN ('WAITING', 'IN_REVIEW', 'CONFIRMING', 'APPROVAL_WAITING') "
            + "AND (n.actor_id IS NULL OR n.actor_id <> n.user_id) "
            + "GROUP BY n.request_id, n.user_id", nativeQuery = true)
    List<Object[]> findLatestOriginalsOfOpenRequests();

    /** Recipients among {@code userIds} who already got this text about the request after {@code since}. */
    @Query("select distinct n.userId from Notification n where n.requestId = :requestId and n.text = :text "
            + "and n.createdAt > :since and n.userId in :userIds")
    List<Long> recentRecipients(@Param("requestId") String requestId, @Param("text") String text,
            @Param("since") Instant since, @Param("userIds") java.util.Collection<Long> userIds);

    @Modifying(flushAutomatically = true)
    @Query("update Notification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);
}
