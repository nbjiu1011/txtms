package com.txtms.domain.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.PasswordReset;

import jakarta.persistence.LockModeType;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {

    Optional<PasswordReset> findByTokenHash(String tokenHash);

    /** The token row under a write lock: two concurrent uses of one link are serialized (single use). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PasswordReset r where r.tokenHash = :hash")
    Optional<PasswordReset> lockByTokenHash(@Param("hash") String tokenHash);

    List<PasswordReset> findByUserId(Long userId);
}
