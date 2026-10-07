package com.txtms.domain.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.auth.entity.LoginAttempt;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, String> {
}
