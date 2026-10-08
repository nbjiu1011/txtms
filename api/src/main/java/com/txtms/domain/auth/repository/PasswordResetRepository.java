package com.txtms.domain.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.PasswordReset;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {

    Optional<PasswordReset> findByTokenHash(String tokenHash);

    /**
     * The token row under a write lock: two concurrent uses of one link are serialized (single use). A native
     * {@code FOR UPDATE} works on MySQL and MariaDB alike (a JPA pessimistic lock can render the MySQL-8-only
     * {@code FOR UPDATE OF alias}).
     */
    @Query(value = "SELECT * FROM password_resets WHERE token_hash = :hash FOR UPDATE", nativeQuery = true)
    Optional<PasswordReset> lockByTokenHash(@Param("hash") String tokenHash);

    List<PasswordReset> findByUserId(Long userId);
}
