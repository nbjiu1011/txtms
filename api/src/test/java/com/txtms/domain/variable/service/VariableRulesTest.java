package com.txtms.domain.variable.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.variable.entity.VariableType;

class VariableRulesTest {

    @Test
    void keyFormat() {
        assertThat(VariableRules.checkKey("customer_name_2")).isEmpty();
        assertThat(VariableRules.checkKey("Customer")).contains("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
        assertThat(VariableRules.checkKey("고객명")).isPresent();
        assertThat(VariableRules.checkKey("a b")).isPresent();
        assertThat(VariableRules.checkKey("")).isPresent();
        assertThat(VariableRules.checkKey(null)).isPresent();
        assertThat(VariableRules.checkKey("a".repeat(65))).isPresent();
    }

    @Test
    void numberValues() {
        for (String ok : List.of("1", "-2", "3.14", " 42 ", "1e3")) {
            assertThat(VariableRules.checkValue(VariableType.NUMBER, ok)).as(ok).isEmpty();
        }
        for (String bad : List.of("", " ", "1,000", "abc", "1.2.3")) {
            assertThat(VariableRules.checkValue(VariableType.NUMBER, bad)).as(bad).contains("정수 또는 소수를 입력하세요");
        }
    }

    @Test
    void dateValues() {
        assertThat(VariableRules.checkValue(VariableType.DATE, "2026-10-07")).isEmpty();
        assertThat(VariableRules.checkValue(VariableType.DATE, "2028-02-29")).isEmpty();
        for (String bad : List.of("2026-02-30", "2026-13-01", "2026-1-7", "20261007", "")) {
            assertThat(VariableRules.checkValue(VariableType.DATE, bad)).as(bad)
                    .contains("유효한 YYYY-MM-DD 날짜를 입력하세요");
        }
    }

    @Test
    void linkValues() {
        assertThat(VariableRules.checkValue(VariableType.LINK, "https://hanbitcard.co.kr/e")).isEmpty();
        assertThat(VariableRules.checkValue(VariableType.LINK, "ftp://files.kr")).contains("HTTP/HTTPS 링크를 입력하세요");
        assertThat(VariableRules.checkValue(VariableType.LINK, "not a link")).contains("유효한 링크를 입력하세요");
    }

    @Test
    void textIsFreeButBounded() {
        assertThat(VariableRules.checkValue(VariableType.TEXT, "")).isEmpty();
        assertThat(VariableRules.checkValue(VariableType.TEXT, "x".repeat(1001))).contains("값은 최대 1,000자입니다");
    }

    @Test
    void inUseMeansAnExactTokenInSomePayload() {
        List<String> payloads = List.of("{\"body\": \"#{points} 적립\"}", "{\"text\": \"없음\"}");
        assertThat(VariableService.inUse("points", payloads)).isTrue();
        assertThat(VariableService.inUse("point", payloads)).isFalse();
    }
}
