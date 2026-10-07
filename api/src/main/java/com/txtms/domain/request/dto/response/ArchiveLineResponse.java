package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestStatus;

/** Contract ArchiveLine (§8): one content line, its latest completion, older completions and open follow-ups. */
public record ArchiveLineResponse(
        String lineKey,
        Latest latest,
        List<Past> past,
        List<FollowUp> followUps,
        List<String> campaigns) {

    public record Latest(String requestId, String contentKey, String title, int version, ContentType type,
            RequestStatus status, Instant completedAt, String campaign, String preview, List<String> fileNames,
            String resolvedText) {
    }

    public record Past(String requestId, String contentKey, String title, int version, Instant completedAt) {
    }

    public record FollowUp(String requestId, RequestStatus status, String title) {
    }
}
