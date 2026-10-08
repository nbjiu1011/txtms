package com.txtms.domain.mail;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Outbox token masking (M6 review: an admin must not be able to use another user's invitation or reset link). */
class OutboxMaskingTest {

    private static final String INVITE = "김서연님, 한빛카드의 TX TMS에 초대되었습니다. 아래 링크에서 7일 안에 이름과 비밀번호를 설정하세요.\n"
            + "http://localhost:4246/invite/AbC-12_xYz0123456789abcdefghijklmnopqrstu";
    private static final String RESET = "비밀번호 재설정 링크입니다.\nhttps://tms.example.com/reset/Zz9_-Qq8";

    @Test
    void invitationAndResetLinksAreMasked() {
        OutboxMasking.Shown invite = OutboxMasking.show(INVITE, false);
        assertThat(invite.masked()).isTrue();
        assertThat(invite.body()).endsWith("http://localhost:4246/invite/••••\n링크는 수신자에게만 전달됩니다")
                .doesNotContain("AbC-12_xYz");
        OutboxMasking.Shown reset = OutboxMasking.show(RESET, false);
        assertThat(reset.masked()).isTrue();
        assertThat(reset.body()).contains("https://tms.example.com/reset/••••").doesNotContain("Zz9_-Qq8");
    }

    @Test
    void mailsWithoutTokenLinksAndRevealedListingsStayAsTheyAre() {
        String reminder = "납기 임박 재통지 3/3: 10월 포인트 적립 이벤트 알림톡";
        assertThat(OutboxMasking.show(reminder, false)).isEqualTo(new OutboxMasking.Shown(reminder, false));
        assertThat(OutboxMasking.show(INVITE, true)).isEqualTo(new OutboxMasking.Shown(INVITE, false));
        assertThat(OutboxMasking.show(null, false).body()).isNull();
    }

    @Test
    void whoMaySeeFullLinks() {
        assertThat(OutboxMasking.revealForCustomerAdmin(true, true)).isTrue();
        assertThat(OutboxMasking.revealForCustomerAdmin(true, false)).isFalse();
        assertThat(OutboxMasking.revealForCustomerAdmin(false, true)).isFalse();
        assertThat(OutboxMasking.revealForOperator(true)).isTrue();
        assertThat(OutboxMasking.revealForOperator(false)).isFalse();
    }
}
