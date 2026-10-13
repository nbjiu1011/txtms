package com.txtms.domain.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Mail templates (contract §23): the plain-text part keeps the wording the outbox has always shown (link masking and
 * tests read it), the HTML part carries the same link and escapes every value.
 */
class MailTemplatesTest {

    private static final MailTemplates TEMPLATES = new MailTemplates();
    private static final String INVITE = "https://tms.example.com/invite/AbC-12_xYz";

    @Test
    void invitation() {
        MailContent mail = TEMPLATES.render(MailTemplates.Template.INVITATION, "TX TMS 초대",
                Map.of("name", "김서연", "customerName", "한빛카드", "link", INVITE, "days", 7L));
        assertThat(mail.subject()).isEqualTo("TX TMS 초대");
        assertThat(mail.text()).isEqualTo("김서연님, 한빛카드의 TX TMS에 초대되었습니다. 아래 링크에서 7일 안에 이름과 비밀번호를 설정하세요.\n"
                + INVITE);
        assertThat(mail.html()).contains("<title>TX TMS 초대</title>", "한빛카드</span>의 TX TMS에 초대되었습니다",
                "href=\"" + INVITE + "\"", "초대 수락하기", "7일")
                .doesNotContain("th:text", "th:href", "th:replace", "th:fragment");
    }

    @Test
    void passwordReset() {
        String link = "https://tms.example.com/reset/Zz9_-Qq8";
        MailContent mail = TEMPLATES.render(MailTemplates.Template.PASSWORD_RESET, "TX TMS 비밀번호 재설정",
                Map.of("name", "박지훈", "link", link, "hours", 1L));
        assertThat(mail.text()).isEqualTo("박지훈님, 아래 링크에서 1시간 안에 새 비밀번호를 설정하세요.\n" + link);
        assertThat(mail.html()).contains("href=\"" + link + "\"", "새 비밀번호 설정", "1시간");
    }

    @Test
    void emailChange() {
        String link = "https://tms.example.com/email-change/Qw-9_Er8";
        MailContent mail = TEMPLATES.render(MailTemplates.Template.EMAIL_CHANGE, "TX TMS 이메일 변경 확인",
                Map.of("name", "김서연", "link", link, "hours", 24L));
        assertThat(mail.text()).isEqualTo("김서연님, TX TMS 로그인 이메일을 이 주소로 바꾸는 요청이 접수되었습니다. 아래 링크에서 24시간 안에 "
                + "확인하면 변경됩니다. 요청한 적이 없다면 이 메일을 무시하세요.\n" + link);
        assertThat(mail.html()).contains("href=\"" + link + "\"", "이메일 변경 확인", "24시간");
    }

    @Test
    void reminder() {
        Map<String, Object> model = Map.of("name", "이도현", "text", "납기 임박 재통지 2/3: 10월 이벤트", "urgent", true,
                "count", 2, "maxCount", 3, "intervalHours", 24L, "title", "10월 이벤트", "requestId", "REQ-2610-121",
                "link", "https://tms.example.com/requests/REQ-2610-121");
        MailContent mail = TEMPLATES.render(MailTemplates.Template.REMINDER, "납기 임박 재통지 2/3: 10월 이벤트", model);
        assertThat(mail.text()).isEqualTo("납기 임박 재통지 2/3: 10월 이벤트\n요청 REQ-2610-121\n"
                + "https://tms.example.com/requests/REQ-2610-121");
        assertThat(mail.html()).contains("납기가 임박한 요청이 있습니다", "재통지 2/3", "REQ-2610-121", "요청 열기",
                "24시간", "3회");
        MailContent overdue = TEMPLATES.render(MailTemplates.Template.REMINDER, "s",
                new java.util.HashMap<>(Map.of("name", "이도현", "text", "미처리 재통지 1/3: 제목", "urgent", false, "count", 1,
                        "maxCount", 3, "intervalHours", 24L, "title", "제목", "requestId", "REQ-1", "link", "https://x")));
        assertThat(overdue.html()).contains("처리하지 않은 요청이 있습니다", "미처리");
    }

    @Test
    void valuesAreEscapedInHtmlAndKeptInText() {
        MailContent mail = TEMPLATES.render(MailTemplates.Template.INVITATION, "TX TMS 초대",
                Map.of("name", "<b>홍</b>", "customerName", "A&B", "link", INVITE, "days", 7L));
        assertThat(mail.html()).contains("&lt;b&gt;홍&lt;/b&gt;", "A&amp;B").doesNotContain("<b>홍</b>");
        assertThat(mail.text()).startsWith("<b>홍</b>님, A&B의");
    }

    @Test
    void theOutboxStillMasksTheRenderedTextLink() {
        MailContent mail = TEMPLATES.render(MailTemplates.Template.INVITATION, "TX TMS 초대",
                Map.of("name", "김서연", "customerName", "한빛카드", "link", INVITE, "days", 7L));
        assertThat(OutboxMasking.show(mail.text(), false).body()).contains("/invite/••••").doesNotContain("AbC-12");
    }
}
