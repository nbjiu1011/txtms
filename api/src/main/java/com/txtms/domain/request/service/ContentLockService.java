package com.txtms.domain.request.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Content edit locks of submitted requests (assigned reviewers in review, the requester while answering): acquire
 * and refresh, own release, forced release, bulk releases of the workflow and the automatic release of idle locks.
 * Drafts have a single author and no locks.
 */
@Service
public class ContentLockService {

    private static final Logger log = LoggerFactory.getLogger(ContentLockService.class);

    static final String AUTO_RELEASE = "편집 잠금 자동 해제";
    static final String RELEASE = "편집 잠금 해제";

    private final ContentRepository contents;
    private final RequestRepository requests;
    private final RequestWriteSupport support;
    private final UserService userService;
    private final NotificationService notifications;
    private final AuditLogService audit;
    private final Duration ttl;
    private final TransactionTemplate tx;

    public ContentLockService(ContentRepository contents, RequestRepository requests, RequestWriteSupport support,
            UserService userService, NotificationService notifications, AuditLogService audit,
            AppProperties properties, PlatformTransactionManager transactionManager) {
        this.contents = contents;
        this.requests = requests;
        this.support = support;
        this.userService = userService;
        this.notifications = notifications;
        this.audit = audit;
        this.ttl = properties.lock().ttl();
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** Releases every lock held by the user (logout). */
    @Transactional
    public int releaseAllOf(long userId) {
        return contents.releaseLocksOf(userId);
    }

    // ------------------------------------------------------------------ user actions

    /**
     * Acquires or refreshes the lock: allowed to whoever may edit the content now (EDIT_CONTENT outside drafts).
     * A free, own or expired lock is taken (an expired one is first logged as released automatically); a valid lock
     * of someone else is LOCKED_BY_OTHER.
     */
    @Transactional
    public ContentResponse.Lock acquire(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        requireSubmitted(ctx);
        Content c = support.content(ctx, key);
        Instant now = support.now();
        switch (EditLocks.state(c.getLockUserId(), c.getLockAt(), ctx.userId(), now, ttl)) {
            case OTHER -> throw lockedByOther(c.getLockUserId());
            case EXPIRED -> logAutoRelease(ctx.request(), c);
            case FREE, MINE -> {
                // taken or refreshed below
            }
        }
        if (contents.tryLock(c.getId(), ctx.userId(), now, EditLocks.expiredBefore(now, ttl)) == 0) {
            throw lockedByOther(c.getLockUserId());
        }
        return new ContentResponse.Lock(ctx.userId(), now, now.plus(ttl));
    }

    /**
     * The holder ends editing (discard, tab closed). No lock, or an expired lock of someone else: nothing to do.
     * A valid lock of someone else: LOCKED_BY_OTHER.
     */
    @Transactional
    public void release(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        Content c = support.content(ctx, key);
        if (c.getLockUserId() == null) {
            return;
        }
        if (c.getLockUserId() == ctx.userId()) {
            c.releaseLock();
            return;
        }
        if (!EditLocks.expired(c.getLockAt(), support.now(), ttl)) {
            throw lockedByOther(c.getLockUserId());
        }
    }

    /**
     * Forced release by the lead reviewer or a customer admin (UNLOCK): history {@code 편집 잠금 해제}, the holder is
     * notified, a customer admin's release is audited. An expired lock is recorded as an automatic release.
     */
    @Transactional
    public void forceRelease(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.UNLOCK);
        Content c = support.content(ctx, key);
        Long owner = c.getLockUserId();
        if (owner == null) {
            return;
        }
        Request r = ctx.request();
        if (EditLocks.expired(c.getLockAt(), support.now(), ttl)) {
            logAutoRelease(r, c);
            c.releaseLock();
            return;
        }
        String ownerName = nameOf(owner);
        c.releaseLock();
        support.log(r, ctx.userId(), RELEASE, ownerName + "님의 잠금", c);
        notifications.notify(List.of(owner), NotificationKind.INFO, r.getId(),
                r.getTitle() + " " + ReviewTexts.target(c.getKey(), c.getTitle()) + ": " + ctx.user().getName()
                        + "님이 편집 잠금을 해제했습니다. 저장하지 않은 수정 내용은 반영되지 않습니다",
                ctx.userId());
        if (ctx.actor().adminOf(ctx.project().getCustomerId())) {
            audit.record(ctx.userId(), ctx.project().getCustomerId(), RELEASE, r.getId(),
                    c.getKey() + " " + ownerName + "님의 잠금");
        }
    }

    // ------------------------------------------------------------------ workflow releases (caller's transaction)

    /**
     * Releases the locks of the request's contents held by users matching {@code owners}, each logged as
     * {@code 편집 잠금 해제} with {@code detail.apply(holder name)}. Returns the released holders.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public List<Long> releaseLogged(Ctx ctx, Predicate<Long> owners, Function<String, String> detail) {
        List<Content> locked = support.currentContents(ctx.request().getId()).stream()
                .filter(c -> c.getLockUserId() != null && owners.test(c.getLockUserId())).toList();
        Map<Long, User> users = userService.byIds(locked.stream().map(Content::getLockUserId).distinct().toList());
        List<Long> released = new ArrayList<>();
        for (Content c : locked) {
            User u = users.get(c.getLockUserId());
            support.log(ctx.request(), ctx.userId(), RELEASE, detail.apply(u == null ? "-" : u.getName()), c);
            released.add(c.getLockUserId());
            c.releaseLock();
        }
        return released;
    }

    /** Releases every lock of the request without separate history entries (recall approval). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void releaseAll(Ctx ctx) {
        support.currentContents(ctx.request().getId()).stream().filter(c -> c.getLockUserId() != null)
                .forEach(Content::releaseLock);
    }

    /** Message when the primary reviewer completes while another user still edits a content. */
    static final String COMPLETE_BLOCKED = "다른 검수자가 편집 중입니다. 저장과 잠금 해제 후 완료하세요";

    /**
     * Review completion: a valid lock of another user blocks it ({@code LOCKED_BY_OTHER}). Checked before any
     * change; {@link #releaseForCompletion} then frees the remaining locks.
     */
    public void requireNoOtherLocks(Ctx ctx) {
        Instant now = support.now();
        boolean blocked = support.currentContents(ctx.request().getId()).stream()
                .anyMatch(c -> EditLocks.state(c.getLockUserId(), c.getLockAt(), ctx.userId(), now, ttl)
                        == EditLocks.State.OTHER);
        if (blocked) {
            throw new BusinessException(ErrorCode.LOCKED_BY_OTHER, COMPLETE_BLOCKED);
        }
    }

    /**
     * Releases every remaining lock at completion: the actor's own locks silently, expired locks of others with
     * {@code 편집 잠금 자동 해제}.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void releaseForCompletion(Ctx ctx) {
        Instant now = support.now();
        for (Content c : support.currentContents(ctx.request().getId())) {
            if (c.getLockUserId() == null) {
                continue;
            }
            if (EditLocks.state(c.getLockUserId(), c.getLockAt(), ctx.userId(), now, ttl) == EditLocks.State.OTHER) {
                throw new BusinessException(ErrorCode.LOCKED_BY_OTHER, COMPLETE_BLOCKED);
            }
            if (c.getLockUserId() != ctx.userId()) {
                logAutoRelease(ctx.request(), c);
            }
            c.releaseLock();
        }
    }

    // ------------------------------------------------------------------ automatic release

    /**
     * Releases every lock idle for the lock time and logs {@code 편집 잠금 자동 해제} ({@code {이름}: 30분간 입력 없음},
     * system actor). Each request is handled in its own transaction under its row lock.
     */
    public int releaseExpired() {
        Instant cutoff = EditLocks.expiredBefore(support.now(), ttl);
        int released = 0;
        for (String requestId : contents.findRequestIdsWithExpiredLocks(cutoff)) {
            try {
                Integer n = tx.execute(status -> releaseExpiredOf(requestId));
                released += n == null ? 0 : n;
            } catch (RuntimeException e) {
                log.warn("Automatic lock release failed for {}", requestId, e);
            }
        }
        return released;
    }

    private int releaseExpiredOf(String requestId) {
        if (requests.lockById(requestId).isEmpty()) {
            return 0;
        }
        Request r = requests.findById(requestId).orElseThrow();
        Instant now = support.now();
        int n = 0;
        for (Content c : contents.findByRequestIdOrderBySortOrderAsc(requestId)) {
            if (c.getLockUserId() != null && EditLocks.expired(c.getLockAt(), now, ttl)) {
                logAutoRelease(r, c);
                c.releaseLock();
                n++;
            }
        }
        return n;
    }

    // ------------------------------------------------------------------ helpers

    private void logAutoRelease(Request r, Content c) {
        support.log(r, null, AUTO_RELEASE, ReviewTexts.autoReleaseDetail(nameOf(c.getLockUserId())), c);
    }

    private String nameOf(Long userId) {
        return userId == null ? "-" : userService.find(userId).map(User::getName).orElse("-");
    }

    /** {@code {이름}님이 이 문안을 편집 중입니다. …} */
    BusinessException lockedByOther(Long holder) {
        return new BusinessException(ErrorCode.LOCKED_BY_OTHER,
                nameOf(holder) + "님이 이 문안을 편집 중입니다. 편집이 끝나면 최신 버전으로 수정할 수 있습니다.");
    }

    static void requireSubmitted(Ctx ctx) {
        if (ctx.request().getStatus() == RequestStatus.DRAFT) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
    }
}
