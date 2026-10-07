package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.txtms.domain.request.dto.request.SaveContentBody;

import tools.jackson.databind.json.JsonMapper;

/** {@code expectedSavedAt}: absent = no check, explicit null = expect never saved, value = nothing newer saved. */
class SaveConflictsTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private static final Instant SAVED = Instant.parse("2026-10-07T05:00:00Z");

    @Test
    void absentNullAndValueAreDistinguished() {
        SaveContentBody absent = json.readValue("{\"payload\":{\"text\":\"a\"}}", SaveContentBody.class);
        assertThat(absent.expectedSavedAtPresent()).isFalse();
        assertThat(absent.payload().path("text").asString()).isEqualTo("a");

        SaveContentBody explicitNull = json.readValue("{\"title\":\"t\",\"expectedSavedAt\":null}",
                SaveContentBody.class);
        assertThat(explicitNull.expectedSavedAtPresent()).isTrue();
        assertThat(explicitNull.expectedSavedAt()).isNull();
        assertThat(explicitNull.title()).isEqualTo("t");

        SaveContentBody value = json.readValue("{\"expectedSavedAt\":\"2026-10-07T05:00:00Z\"}", SaveContentBody.class);
        assertThat(value.expectedSavedAtPresent()).isTrue();
        assertThat(value.expectedSavedAt()).isEqualTo(SAVED);
    }

    @Test
    void conflictRule() {
        assertThat(SaveConflicts.conflicts(false, null, SAVED)).isFalse();
        assertThat(SaveConflicts.conflicts(true, null, null)).isFalse();
        assertThat(SaveConflicts.conflicts(true, null, SAVED)).isTrue();
        assertThat(SaveConflicts.conflicts(true, SAVED, SAVED)).isFalse();
        assertThat(SaveConflicts.conflicts(true, SAVED.minusSeconds(1), SAVED)).isTrue();
        assertThat(SaveConflicts.conflicts(true, SAVED.plusSeconds(1), SAVED)).isFalse();
        assertThat(SaveConflicts.conflicts(true, SAVED, null)).isFalse();
    }
}
