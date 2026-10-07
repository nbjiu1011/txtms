package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.txtms.domain.request.policy.RequestAction;

/**
 * Contract RequestDetail (§3.2) = RequestSummary fields + the fields below. The summary's {@code contents}
 * ({@code key, title}) is replaced by the full Content list of the detail.
 */
public record RequestDetail(
        @JsonUnwrapped @JsonIgnoreProperties("contents") RequestSummary summary,
        String purpose,
        String target,
        String background,
        Recall recall,
        Parent parent,
        List<ContentResponse> contents,
        List<OpinionResponse> opinions,
        List<AskResponse> asks,
        List<Long> eligibleApproverIds,
        List<CoReviewer> coReviewers,
        int historyCount,
        Map<String, Instant> stageTimes,
        BundleResponse bundle,
        Set<RequestAction> allowedActions,
        long rowVersion,
        int nextSubmitRound) {

    public record Recall(Long requestedBy, Instant requestedAt, String reason) {
    }

    public record Parent(String requestId, String contentKey) {
    }

    /** Co-review result of one reviewer (current, or previous with opinions). */
    public record CoReviewer(long userId, boolean current, boolean primary, int opinionCount,
            List<RoundCount> rounds) {
    }

    public record RoundCount(int round, int count) {
    }
}
