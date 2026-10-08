package com.txtms.domain.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.UserInvitation;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, Long> {

    Optional<UserInvitation> findByTokenHash(String tokenHash);

    /**
     * The token row under a write lock: two concurrent acceptances of one link are serialized (single use). A native
     * {@code FOR UPDATE} works on MySQL and MariaDB alike (a JPA pessimistic lock can render the MySQL-8-only
     * {@code FOR UPDATE OF alias}).
     */
    @Query(value = "SELECT * FROM user_invitations WHERE token_hash = :hash FOR UPDATE", nativeQuery = true)
    Optional<UserInvitation> lockByTokenHash(@Param("hash") String tokenHash);

    List<UserInvitation> findByUserIdOrderByIdDesc(Long userId);

    List<UserInvitation> findByUserIdIn(java.util.Collection<Long> userIds);
}
