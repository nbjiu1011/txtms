package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.service.ContentLineage.Ref;

import tools.jackson.databind.json.JsonMapper;

/** Content lineage, archive grouping and filters, and the co-review summary. */
class ArchiveRulesTest {

    private final JsonMapper json = JsonMapper.builder().build();

    // ------------------------------------------------------------------ lineage

    @Test
    void lineageFollowsPerContentSourcesToTheRoot() {
        Map<Ref, Ref> sources = new HashMap<>();
        sources.put(new Ref("R2", "C1"), new Ref("R1", "C2"));
        sources.put(new Ref("R3", "C1"), new Ref("R2", "C1"));
        sources.put(new Ref("R3", "C2"), new Ref("R1", "C1"));
        assertThat(ContentLineage.lineKey(new Ref("R3", "C1"), sources)).isEqualTo("R1:C2");
        assertThat(ContentLineage.lineKey(new Ref("R3", "C2"), sources)).isEqualTo("R1:C1");
        assertThat(ContentLineage.lineKey(new Ref("R1", "C2"), sources)).isEqualTo("R1:C2");
        assertThat(ContentLineage.lineKey(new Ref("R9", "C1"), sources)).isEqualTo("R9:C1");
    }

    @Test
    void lineageStopsOnCyclesAndOverlongChains() {
        Map<Ref, Ref> cycle = Map.of(new Ref("A", "C1"), new Ref("B", "C1"), new Ref("B", "C1"), new Ref("A", "C1"));
        assertThat(ContentLineage.lineKey(new Ref("A", "C1"), cycle)).isEqualTo("B:C1");
        Map<Ref, Ref> chain = new HashMap<>();
        for (int i = 0; i < 80; i++) {
            chain.put(new Ref("R" + (i + 1), "C1"), new Ref("R" + i, "C1"));
        }
        assertThat(ContentLineage.root(new Ref("R80", "C1"), chain))
                .isEqualTo(new Ref("R" + (80 - ContentLineage.MAX_DEPTH), "C1"));
    }

    // ------------------------------------------------------------------ archive lines

    private ArchiveLines.Completed completed(String line, String requestId, String completedAt, String campaign,
            RequestStatus status, ContentType type, String payload, List<ArchiveLines.FileRef> files) {
        return new ArchiveLines.Completed(line, requestId, "요청 " + requestId, type, status,
                Instant.parse(completedAt), campaign, "C1", "제목 " + requestId, 1, json.readTree(payload), files,
                Map.of("customer_name", "홍길동"));
    }

    private ArchiveLines.Completed sms(String line, String requestId, String completedAt, String campaign) {
        return completed(line, requestId, completedAt, campaign, RequestStatus.APPROVED, ContentType.SMS,
                "{\"body\":\"#{customer_name}님 " + requestId + " 안내\"}", List.of());
    }

    private static ArchiveLines.Criteria none() {
        return new ArchiveLines.Criteria(null, null, null, null, null, null);
    }

    @Test
    void linesShowTheLatestCompletionFirstWithPastAndFollowUps() {
        List<ArchiveLines.Completed> completed = List.of(
                sms("R1:C1", "R1", "2026-09-01T00:00:00Z", "8월"),
                sms("R1:C1", "R2", "2026-09-20T00:00:00Z", "9월"),
                sms("R5:C1", "R5", "2026-09-10T00:00:00Z", null));
        List<ArchiveLines.FollowUp> followUps = List.of(
                new ArchiveLines.FollowUp("R1:C1", "R7", RequestStatus.DRAFT, "후속", Instant.parse("2026-09-21T00:00:00Z")),
                new ArchiveLines.FollowUp("R1:C1", "R7", RequestStatus.DRAFT, "후속", Instant.parse("2026-09-21T00:00:00Z")),
                new ArchiveLines.FollowUp("R1:C1", "R8", RequestStatus.WAITING, "후속2",
                        Instant.parse("2026-09-25T00:00:00Z")));
        List<ArchiveLines.Line> lines = ArchiveLines.build(completed, followUps, none());
        assertThat(lines).extracting(ArchiveLines.Line::lineKey).containsExactly("R1:C1", "R5:C1");
        ArchiveLines.Line first = lines.getFirst();
        assertThat(first.latest().requestId()).isEqualTo("R2");
        assertThat(first.past()).extracting(ArchiveLines.Completed::requestId).containsExactly("R1");
        assertThat(first.followUps()).extracting(ArchiveLines.FollowUp::requestId).containsExactly("R8", "R7");
        assertThat(first.campaigns()).containsExactly("9월", "8월");
        assertThat(lines.get(1).campaigns()).isEmpty();
        assertThat(ArchiveLines.resolvedText(first.latest())).isEqualTo("홍길동님 R2 안내");
    }

    @Test
    void filtersApplyToTheLatestCompletion() {
        List<ArchiveLines.Completed> completed = List.of(
                sms("R1:C1", "R1", "2026-09-01T00:00:00Z", "8월"),
                sms("R1:C1", "R2", "2026-09-20T00:00:00Z", "9월"),
                completed("R5:C1", "R5", "2026-09-10T14:59:59Z", "9월", RequestStatus.REVIEW_COMPLETED,
                        ContentType.FREEFORM, "{\"title\":\"약관\",\"text\":\"\"}",
                        List.of(new ArchiveLines.FileRef("개정안_FINAL.pdf", 2))));
        // the older completion of R1:C1 matches "R1" but only the latest is searched
        assertThat(keys(completed, new ArchiveLines.Criteria("r1 안내", null, null, null, null, null))).isEmpty();
        assertThat(keys(completed, new ArchiveLines.Criteria("R2 안내", null, null, null, null, null)))
                .containsExactly("R1:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria("final", null, null, null, null, null)))
                .containsExactly("R5:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria("요청 r5", null, null, null, null, null)))
                .containsExactly("R5:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria(null, ContentType.FREEFORM, null, null, null, null)))
                .containsExactly("R5:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria(null, null, "8월", null, null, null))).isEmpty();
        assertThat(keys(completed, new ArchiveLines.Criteria(null, null, "9월", null, null, null)))
                .containsExactly("R1:C1", "R5:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria(null, null, null, RequestStatus.APPROVED, null, null)))
                .containsExactly("R1:C1");
        // 2026-09-10T14:59:59Z is 2026-09-10 23:59:59 KST: inclusive on both ends
        assertThat(keys(completed, new ArchiveLines.Criteria(null, null, null, null, LocalDate.of(2026, 9, 10),
                LocalDate.of(2026, 9, 10)))).containsExactly("R5:C1");
        assertThat(keys(completed, new ArchiveLines.Criteria(null, null, null, null, LocalDate.of(2026, 9, 11),
                null))).containsExactly("R1:C1");
    }

    private static List<String> keys(List<ArchiveLines.Completed> completed, ArchiveLines.Criteria c) {
        return ArchiveLines.build(completed, List.of(), c).stream().map(ArchiveLines.Line::lineKey).toList();
    }

    @Test
    void previewShowsFileNamesOrTheFirstCharactersOfTheResolvedText() {
        ArchiveLines.Completed withFile = completed("A:C1", "A", "2026-09-01T00:00:00Z", null,
                RequestStatus.APPROVED, ContentType.FREEFORM, "{\"title\":\"t\",\"text\":\"\"}",
                List.of(new ArchiveLines.FileRef("a.pdf", 2), new ArchiveLines.FileRef("b.png", 1)));
        assertThat(ArchiveLines.preview(withFile)).isEqualTo("a.pdf (v2), b.png (v1)");
        String longBody = "가".repeat(200);
        ArchiveLines.Completed text = completed("B:C1", "B", "2026-09-01T00:00:00Z", null, RequestStatus.APPROVED,
                ContentType.ALIMTALK, "{\"body\":\"" + longBody + "\",\"buttons\":[]}", List.of());
        assertThat(ArchiveLines.preview(text)).hasSize(ArchiveLines.PREVIEW_LENGTH);
        ArchiveLines.Completed rcs = completed("C:C1", "C", "2026-09-01T00:00:00Z", null, RequestStatus.APPROVED,
                ContentType.RCS, "{\"cards\":[{\"body\":\"#{customer_name}\"},{\"body\":\"둘\"}]}", List.of());
        assertThat(ArchiveLines.resolvedText(rcs)).isEqualTo("홍길동\n둘");
    }

    @Test
    void rawPreviewKeepsVariableTokensAndShowsFileNames() {
        ArchiveLines.Completed withFile = completed("A:C1", "A", "2026-09-01T00:00:00Z", null,
                RequestStatus.APPROVED, ContentType.FREEFORM, "{\"title\":\"t\",\"text\":\"#{customer_name}\"}",
                List.of(new ArchiveLines.FileRef("a.pdf", 2)));
        assertThat(ArchiveLines.previewRaw(withFile)).isEqualTo("a.pdf (v2)");
        ArchiveLines.Completed rcs = completed("C:C1", "C", "2026-09-01T00:00:00Z", null, RequestStatus.APPROVED,
                ContentType.RCS, "{\"cards\":[{\"body\":\"#{customer_name}님\"},{\"body\":\"둘\"}]}", List.of());
        assertThat(ArchiveLines.previewRaw(rcs)).isEqualTo("#{customer_name}님\n둘");
        assertThat(ArchiveLines.preview(rcs)).isEqualTo("홍길동님\n둘");
        String longBody = "#{customer_name}" + "가".repeat(200);
        ArchiveLines.Completed text = completed("B:C1", "B", "2026-09-01T00:00:00Z", null, RequestStatus.APPROVED,
                ContentType.ALIMTALK, "{\"body\":\"" + longBody + "\",\"buttons\":[]}", List.of());
        assertThat(ArchiveLines.previewRaw(text)).hasSize(ArchiveLines.PREVIEW_LENGTH)
                .startsWith("#{customer_name}가");
    }

    // ------------------------------------------------------------------ co-review summary

    @Test
    void coReviewersListCurrentReviewersThenPreviousOnesWithOpinions() {
        List<RequestDetail.CoReviewer> list = CoReviewers.of(List.of(2L, 6L), 6L, List.of(
                new CoReviewers.Opinion(3, 1), new CoReviewers.Opinion(2, 1), new CoReviewers.Opinion(2, 2),
                new CoReviewers.Opinion(3, 1)));
        assertThat(list).extracting(RequestDetail.CoReviewer::userId).containsExactly(2L, 6L, 3L);
        assertThat(list.get(0).current()).isTrue();
        assertThat(list.get(0).primary()).isFalse();
        assertThat(list.get(0).opinionCount()).isEqualTo(2);
        assertThat(list.get(0).rounds()).containsExactly(new RequestDetail.RoundCount(1, 1),
                new RequestDetail.RoundCount(2, 1));
        assertThat(list.get(1).primary()).isTrue();
        assertThat(list.get(1).opinionCount()).isZero();
        assertThat(list.get(1).rounds()).isEmpty();
        assertThat(list.get(2).current()).isFalse();
        assertThat(list.get(2).rounds()).containsExactly(new RequestDetail.RoundCount(1, 2));
        assertThat(CoReviewers.of(List.of(), null, List.of())).isEmpty();
    }

    @Test
    void revisionRequestDetailIncludesTheOptionalLocation() {
        assertThat(ReviewTexts.revisionRequest("오타", "C1", null, "수정")).isEqualTo("사유: 오타\n위치: C1\n기대 내용: 수정");
        assertThat(ReviewTexts.revisionRequest("오타", "C2", "카드 1 본문", "수정"))
                .isEqualTo("사유: 오타\n위치: C2 카드 1 본문\n기대 내용: 수정");
    }
}
