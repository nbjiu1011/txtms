package com.txtms.domain.auth.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.UserSession;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);

    @Modifying(flushAutomatically = true)
    @Query("update UserSession s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null")
    int revokeAllOf(@Param("userId") Long userId, @Param("now") Instant now);

    @Modifying(flushAutomatically = true)
    @Query("update UserSession s set s.revokedAt = :now where s.userId = :userId and s.id <> :keepId "
            + "and s.revokedAt is null")
    int revokeAllOfExcept(@Param("userId") Long userId, @Param("keepId") Long keepId, @Param("now") Instant now);
}
