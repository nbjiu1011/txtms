package com.txtms.domain.ops.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import org.junit.jupiter.api.Test;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Operator customer creation rules (actions.md §2.14 {@code opsCustNew}). */
class CustomerRulesTest {

    private static String domainError(String raw) {
        BusinessException e = catchThrowableOfType(BusinessException.class, () -> CustomerRules.domain(raw));
        assertThat(e).as(raw).isNotNull();
        assertThat(e.getCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
        return e.getMessage();
    }

    @Test
    void domainIsTrimmedLowerCasedAndLosesALeadingAt() {
        assertThat(CustomerRules.domain("  @Example.CO.KR ")).isEqualTo("example.co.kr");
        assertThat(CustomerRules.domain("sub-1.my-company.com")).isEqualTo("sub-1.my-company.com");
        assertThat(CustomerRules.domain("a.io")).isEqualTo("a.io");
    }

    @Test
    void pastedAddressesEmailsAndKoreanDomainsAreNormalized() {
        assertThat(CustomerRules.domain("admin@TagoPlus.co.kr")).isEqualTo("tagoplus.co.kr");
        assertThat(CustomerRules.domain("https://www.tagoplus.co.kr:8080/login?x=1")).isEqualTo("tagoplus.co.kr");
        assertThat(CustomerRules.domain("http://tagoplus.co.kr/")).isEqualTo("tagoplus.co.kr");
        assertThat(CustomerRules.domain("tagoplus.co.kr.")).isEqualTo("tagoplus.co.kr");
        assertThat(CustomerRules.domain("txtms.tagoplus.co.kr")).isEqualTo("txtms.tagoplus.co.kr");
        assertThat(CustomerRules.domain("예시.com")).isEqualTo("xn--vv4b11d.com");
        assertThat(CustomerRules.domain("회사.한국")).isEqualTo("xn--vf4b131b.xn--3e0b707e");
    }

    @Test
    void invalidDomainsAreRefused() {
        assertThat(domainError(null)).isEqualTo("회사 도메인을(를) 입력하세요");
        assertThat(domainError("  @ ")).isEqualTo("회사 도메인을(를) 입력하세요");
        assertThat(domainError("")).isEqualTo("회사 도메인을(를) 입력하세요");
        assertThat(domainError("https://")).isEqualTo("회사 도메인을(를) 입력하세요");
        assertThat(domainError("user@")).isEqualTo("회사 도메인을(를) 입력하세요");
        for (String bad : new String[] {"example", "example.c", "-a.com", "a-.com", "a..com", "exa mple.com",
                "example.123", ".example.com", "http://localhost:8080"}) {
            assertThat(domainError(bad)).as(bad).isEqualTo("도메인 형식을 확인하세요");
        }
        assertThat(domainError("a".repeat(64) + ".com")).isEqualTo("도메인 형식을 확인하세요");
    }

    @Test
    void nameAndReasonAreRequiredAndBounded() {
        assertThat(CustomerRules.name("  한빛카드 ")).isEqualTo("한빛카드");
        assertThat(catchThrowableOfType(BusinessException.class, () -> CustomerRules.name(" ")).getMessage())
                .isEqualTo("고객사 이름을(를) 입력하세요");
        assertThat(catchThrowableOfType(BusinessException.class, () -> CustomerRules.name("가".repeat(101)))
                .getMessage()).isEqualTo("고객사 이름은 최대 100자입니다");
        assertThat(catchThrowableOfType(BusinessException.class, () -> CustomerRules.reason(null)).getMessage())
                .isEqualTo("비활성 사유을(를) 입력하세요");
        assertThat(catchThrowableOfType(BusinessException.class, () -> CustomerRules.reason("x".repeat(501)))
                .getMessage()).isEqualTo("비활성 사유는 최대 500자입니다");
        assertThat(CustomerRules.reason(" 계약 종료 ")).isEqualTo("계약 종료");
    }

    @Test
    void duplicateWordingNamesTheExistingCustomer() {
        assertThat(CustomerRules.duplicateDomain("한빛카드"))
                .isEqualTo("한빛카드이(가) 같은 도메인을 쓰고 있습니다");
    }
}
