package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.txtms.global.common.Downloads;

class RequestIdGeneratorTest {

    @Test
    void formatsKstMonthAndAtLeastThreeDigits() {
        assertThat(RequestIdGenerator.format(Instant.parse("2026-10-07T05:00:00Z"), 121)).isEqualTo("REQ-2610-121");
        assertThat(RequestIdGenerator.format(Instant.parse("2026-10-07T05:00:00Z"), 7)).isEqualTo("REQ-2610-007");
        assertThat(RequestIdGenerator.format(Instant.parse("2026-10-07T05:00:00Z"), 1234)).isEqualTo("REQ-2610-1234");
    }

    @Test
    void monthBoundaryFollowsKst() {
        // 2026-10-31 15:00 UTC is already 2026-11-01 00:00 KST
        assertThat(RequestIdGenerator.format(Instant.parse("2026-10-31T15:00:00Z"), 5)).isEqualTo("REQ-2611-005");
        assertThat(RequestIdGenerator.format(Instant.parse("2026-10-31T14:59:59Z"), 5)).isEqualTo("REQ-2610-005");
        assertThat(RequestIdGenerator.format(Instant.parse("2026-12-31T15:00:00Z"), 5)).isEqualTo("REQ-2701-005");
    }

    @Test
    void contentDispositionHasAsciiFallbackAndUtf8Name() {
        assertThat(Downloads.contentDisposition("attachment", "약관 개정안 \"v2\".pdf")).isEqualTo(
                "attachment; filename=\"__ ___ _v2_.pdf\"; filename*=UTF-8''"
                        + "%EC%95%BD%EA%B4%80%20%EA%B0%9C%EC%A0%95%EC%95%88%20%22v2%22.pdf");
        assertThat(Downloads.contentDisposition("attachment", "plain.txt"))
                .isEqualTo("attachment; filename=\"plain.txt\"; filename*=UTF-8''plain.txt");
    }
}
