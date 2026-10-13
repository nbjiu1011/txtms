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
        Instant publishedAt,
        boolean edited,
        boolean published,
        boolean deleted,
        List<Log> logs) {

    /**
     * Snapshot before a change and who made it: {@code 수정}, {@code 게시}, {@code 게시 중지}, {@code 삭제}, {@code 복원} (and
     * {@code 철회} of notices withdrawn before publishing could be switched).
     */
    public record Log(Instant at, long actorId, String action, NoticeScope previousScope, Long previousProjectId,
            String previousTitle, String previousBody) {
    }
}
