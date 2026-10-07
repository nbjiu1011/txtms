package com.txtms.domain.notice.dto;

import java.time.Instant;
import java.util.List;

import com.txtms.domain.notice.entity.NoticeScope;

/** Contract Notice (§10). */
public record NoticeResponse(
        long id,
        NoticeScope scope,
        long customerId,
        Long projectId,
        String title,
        String body,
        long authorId,
        Instant createdAt,
        boolean edited,
        boolean withdrawn,
        List<Log> logs) {

    public record Log(Instant at, long actorId, String action, String previousTitle, String previousBody) {
    }
}
