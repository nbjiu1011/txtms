package com.txtms.domain.notice.dto;

import com.txtms.domain.notice.entity.NoticeScope;

/** Notice create / edit body. On edit, omitted (null) keys keep the current value. */
public record NoticeBody(NoticeScope scope, Long projectId, String title, String body) {
}
