package com.txtms.domain.auth.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.EmailChange;

public interface EmailChangeRepository extends JpaRepository<EmailChange, Long> {

    Optional<EmailChange> findByTokenHash(String tokenHash);

    /**
     * The token row under a write lock: two concurrent confirmations of one link are serialized (single use). A
     * native {@code FOR UPDATE} works on MySQL and MariaDB alike (a JPA pessimistic lock can render the MySQL-8-only
     * {@code FOR UPDATE OF alias}).
     */
    @Query(value = "SELECT * FROM email_changes WHERE token_hash = :hash FOR UPDATE", nativeQuery = true)
    Optional<EmailChange> lockByTokenHash(@Param("hash") String tokenHash);

    List<EmailChange> findByUserId(Long userId);

    List<EmailChange> findByUserIdIn(Collection<Long> userIds);
}
