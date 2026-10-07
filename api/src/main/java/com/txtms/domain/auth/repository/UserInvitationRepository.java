package com.txtms.domain.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.auth.entity.UserInvitation;

public interface UserInvitationRepository extends JpaRepository<UserInvitation, Long> {

    Optional<UserInvitation> findByTokenHash(String tokenHash);

    List<UserInvitation> findByUserIdOrderByIdDesc(Long userId);

    List<UserInvitation> findByUserIdIn(java.util.Collection<Long> userIds);
}
