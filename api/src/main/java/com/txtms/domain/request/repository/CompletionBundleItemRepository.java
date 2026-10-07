package com.txtms.domain.request.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.CompletionBundleItem;

public interface CompletionBundleItemRepository extends JpaRepository<CompletionBundleItem, Long> {

    List<CompletionBundleItem> findByRequestIdOrderBySortOrderAsc(String requestId);
}
