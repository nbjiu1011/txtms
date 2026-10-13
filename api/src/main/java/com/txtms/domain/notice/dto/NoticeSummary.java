package com.txtms.domain.notice.dto;

import java.time.Instant;

import com.txtms.domain.notice.entity.NoticeScope;

/** Subset of Notice for dashboard panels. */
public record NoticeSummary(long id, NoticeScope scope, long customerId, Long projectId, String title,
        Instant createdAt,
        Instant publishedAt) {
}
