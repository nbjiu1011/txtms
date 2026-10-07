package com.txtms.domain.request.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.CompletionBundle;

public interface CompletionBundleRepository extends JpaRepository<CompletionBundle, String> {
}
