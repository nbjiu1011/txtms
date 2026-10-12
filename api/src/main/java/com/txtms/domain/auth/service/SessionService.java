package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.entity.UserSession;
import com.txtms.domain.auth.repository.UserSessionRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;
import com.txtms.global.security.SessionValidator;

/** Server sessions: creation, per-request validation with activity tracking, refresh and revocation. */
@Service
public class SessionService implements SessionValidator {

    public static final String INACTIVE_MESSAGE = "비활성 계정 또는 고객사입니다";

    private final UserSessionRepository repository;
    private final UserService userService;
    private final Clock clock;
    private final SessionExpiryPolicy policy;

    public SessionService(UserSessionRepository repository, UserService userService, Clock clock,
            AppProperties properties) {
        this.repository = repository;
        this.userService = userService;
        this.clock = clock;
        AppProperties.Session s = properties.session();
        this.policy = new SessionExpiryPolicy(s.idleTimeout(), s.rememberDuration(), s.touchInterval());
    }

    public record Created(UserSession session, String refreshToken) {
    }

    @Transactional
    public Created create(User user, boolean remember, boolean demo) {
        Instant now = clock.instant();
        String token = OpaqueTokens.generate();
        UserSession session = new UserSession(user.getId(), OpaqueTokens.hash(token), remember, demo, now,
                policy.expiresAt(remember, now, now));
        return new Created(repository.save(session), token);
    }

    /** Called for every bearer-authenticated request. */
    @Override
    @Transactional
    public void validate(AuthUser authUser) {
        UserSession session = repository.findById(authUser.sessionId())
                .filter(s -> s.getUserId() == authUser.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));
        checkAndTouch(session);
    }

    /** Resolves the session of a refresh token, validating and touching it. */
    @Transactional
    public UserSession refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.SESSION_EXPIRED);
        }
        UserSession session = repository.findByRefreshTokenHash(OpaqueTokens.hash(refreshToken))
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));
        checkAndTouch(session);
        return session;
    }

    @Transactional(readOnly = true)
    public UserSession require(long sessionId) {
        return repository.findById(sessionId).orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));
    }

    @Transactional
    public void revoke(long sessionId) {
        repository.findById(sessionId).ifPresent(s -> s.revoke(clock.instant()));
    }

    @Transactional
    public void revokeAllOf(long userId) {
        repository.revokeAllOf(userId, clock.instant());
    }

    /** Ends every session of the user except {@code keepSessionId}; returns how many were ended. */
    @Transactional
    public int revokeOthersOf(long userId, long keepSessionId) {
        return repository.revokeAllOfExcept(userId, keepSessionId, clock.instant());
    }

    public Instant expiresAt(UserSession session) {
        return policy.expiresAt(session.isRemember(), session.getStartedAt(), session.getLastSeenAt());
    }

    private void checkAndTouch(UserSession session) {
        Instant now = clock.instant();
        if (session.isRevoked()
                || policy.expired(session.isRemember(), session.getStartedAt(), session.getLastSeenAt(), now)) {
            throw new BusinessException(ErrorCode.SESSION_EXPIRED);
        }
        User user = userService.find(session.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));
        if (!userService.canUseAccount(user)) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, INACTIVE_MESSAGE);
        }
        if (policy.shouldTouch(session.getLastSeenAt(), now)) {
            session.touch(now, policy.expiresAt(session.isRemember(), session.getStartedAt(), now));
        }
    }
}
