package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.entity.LoginAttempt;
import com.txtms.domain.auth.repository.LoginAttemptRepository;
import com.txtms.global.config.AppProperties;

/**
 * Consecutive login failure tracking per email. Runs in its own transaction so a failure is recorded even though
 * the login call itself fails.
 */
@Service
public class LoginAttemptService {

    private final LoginAttemptRepository repository;
    private final Clock clock;
    private final AppProperties.Auth settings;

    public LoginAttemptService(LoginAttemptRepository repository, Clock clock, AppProperties properties) {
        this.repository = repository;
        this.clock = clock;
        this.settings = properties.auth();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public boolean isLocked(String email) {
        Instant now = clock.instant();
        return repository.findById(email).map(a -> a.isLocked(now)).orElse(false);
    }

    /** @return true when this failure locked the email */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(String email) {
        Instant now = clock.instant();
        LoginAttempt attempt = repository.findById(email).orElseGet(() -> new LoginAttempt(email, now));
        boolean locked = attempt.recordFailure(now, settings.loginMaxFailures(), settings.loginLockDuration());
        repository.save(attempt);
        return locked;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clear(String email) {
        repository.deleteById(email);
    }
}
