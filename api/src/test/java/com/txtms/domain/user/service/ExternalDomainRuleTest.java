package com.txtms.domain.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** External domain confirmation: same code for invitations and email changes, different wording. */
class ExternalDomainRuleTest {

    private final Customer customer = new Customer("한빛카드", "hanbitcard.co.kr", true, false, NotifyChannel.IN_APP, 3,
            null, Instant.parse("2026-10-07T00:00:00Z"));

    @Test
    void anOutsideDomainNeedsConfirmation() {
        BusinessException e = catchThrowableOfType(BusinessException.class, () -> MemberAdminService
                .requireDomainConfirmed(customer, "a@partner.example", null,
                        MemberAdminService.EMAIL_CHANGE_EXTERNAL_DOMAIN));
        assertThat(e.getCode()).isEqualTo(ErrorCode.EXTERNAL_DOMAIN_CONFIRM_REQUIRED);
        assertThat(e.getMessage()).isEqualTo("회사 도메인이 아닌 이메일입니다. 확인 후 다시 저장하세요");
        assertThatCode(() -> MemberAdminService.requireDomainConfirmed(customer, "a@partner.example", true,
                MemberAdminService.EMAIL_CHANGE_EXTERNAL_DOMAIN)).doesNotThrowAnyException();
        assertThatCode(() -> MemberAdminService.requireDomainConfirmed(customer, "a@hanbitcard.co.kr", false,
                MemberAdminService.EMAIL_CHANGE_EXTERNAL_DOMAIN)).doesNotThrowAnyException();
    }

    @Test
    void invitationAndEmailChangeReadDifferently() {
        assertThat(MemberAdminService.INVITE_EXTERNAL_DOMAIN)
                .isEqualTo("회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다")
                .isNotEqualTo(MemberAdminService.EMAIL_CHANGE_EXTERNAL_DOMAIN);
    }
}
