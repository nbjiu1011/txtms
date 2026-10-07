package com.txtms.domain.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.auth.entity.UserInvitation;

import jakarta.persistence.LockModeType;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, Long> {

    Optional<UserInvitation> findByTokenHash(String tokenHash);

    /** The token row under a write lock: two concurrent acceptances of one link are serialized (single use). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from UserInvitation i where i.tokenHash = :hash")
    Optional<UserInvitation> lockByTokenHash(@Param("hash") String tokenHash);

    List<UserInvitation> findByUserIdOrderByIdDesc(Long userId);

    List<UserInvitation> findByUserIdIn(java.util.Collection<Long> userIds);
}
