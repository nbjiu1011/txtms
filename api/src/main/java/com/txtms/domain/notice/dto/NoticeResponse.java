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

    /** Snapshot before a change ({@code 수정}) or withdrawal ({@code 철회}) and who made it. */
    public record Log(Instant at, long actorId, String action, NoticeScope previousScope, Long previousProjectId,
            String previousTitle, String previousBody) {
    }
}
