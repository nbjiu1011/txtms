package com.txtms.domain.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/** Who may receive real mail (contract §23): everyone outside demo mode, the allow list in demo mode. */
class MailRecipientPolicyTest {

    private static final List<String> ALLOW = List.of("@TagoPlus.co.kr", " qa@example.com ");

    @Test
    void outsideDemoModeEveryoneGetsMail() {
        assertThat(MailRecipientPolicy.deliverable(false, List.of(), "jihoon.park@hanbitcard.co.kr")).isTrue();
    }

    @Test
    void demoModeSendsOnlyToAllowedDomainsAndAddresses() {
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, "kim@tagoplus.co.kr")).isTrue();
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, "QA@Example.com")).isTrue();
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, "jihoon.park@hanbitcard.co.kr")).isFalse();
        // a domain entry matches the whole domain only, an address entry the exact address only
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, "kim@nottagoplus.co.kr")).isFalse();
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, "other@example.com")).isFalse();
    }

    @Test
    void demoModeWithoutAllowListSendsNothing() {
        assertThat(MailRecipientPolicy.deliverable(true, List.of(), "kim@tagoplus.co.kr")).isFalse();
        assertThat(MailRecipientPolicy.deliverable(true, List.of(" ", ""), "kim@tagoplus.co.kr")).isFalse();
        assertThat(MailRecipientPolicy.deliverable(true, ALLOW, null)).isFalse();
    }
}
