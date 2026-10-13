package com.txtms.domain.notice.dto;

import com.txtms.domain.notice.entity.NoticeScope;

/**
 * Notice create / edit body. On edit, omitted (null) keys keep the current value. {@code published} only applies on
 * create (omitted = published); the publish state is changed by its own endpoints.
 */
public record NoticeBody(NoticeScope scope, Long projectId, String title, String body, Boolean published) {
}
