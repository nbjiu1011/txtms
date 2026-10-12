package com.txtms.global.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RichTextTest {

    @Test
    void keepsTheEditorFormatting() {
        String html = "<p class=\"ql-align-center\"><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소</s></p>"
                + "<p><span class=\"ql-font-serif ql-size-large\" style=\"color: rgb(230, 0, 0); background-color: #ffff00;\">"
                + "색</span></p><ol><li data-list=\"ordered\">하나</li><li data-list=\"bullet\" class=\"ql-indent-1\">둘</li>"
                + "</ol><p><a href=\"https://txtms.io/a\">링크</a></p>";
        RichText.Result r = RichText.sanitize(html);
        assertThat(r.html()).contains("<p class=\"ql-align-center\"><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소</s></p>")
                .contains("<span class=\"ql-font-serif ql-size-large\" style=\"color: rgb(230, 0, 0); background-color: #ffff00\">")
                .contains("<li data-list=\"ordered\">하나</li>")
                .contains("<li data-list=\"bullet\" class=\"ql-indent-1\">둘</li>")
                .contains("<a href=\"https://txtms.io/a\" rel=\"noopener noreferrer\" target=\"_blank\">링크</a>");
        assertThat(r.text()).isEqualTo("굵게 기울임 밑줄 취소 색 하나 둘 링크");
        assertThat(r.hasImage()).isFalse();
    }

    @Test
    void removesScriptsHandlersUnsafeUrlsStylesAndClasses() {
        String html = "<p onclick=\"x()\" class=\"evil ql-align-right\">a<script>alert(1)</script></p>"
                + "<p><a href=\"javascript:alert(1)\">b</a><span style=\"position: fixed; color: red; "
                + "background-color: url(x)\">c</span></p><iframe src=\"https://x\"></iframe>"
                + "<img src=\"https://x.kr/a.png\" onerror=\"x()\"><img src=\"data:text/html;base64,PGI+\">"
                + "<li data-list=\"checked\">d</li>";
        String out = RichText.sanitize(html).html();
        assertThat(out).doesNotContain("script").doesNotContain("onclick").doesNotContain("onerror")
                .doesNotContain("javascript").doesNotContain("iframe").doesNotContain("evil")
                .doesNotContain("position").doesNotContain("red").doesNotContain("url(")
                .doesNotContain("data:text").doesNotContain("checked");
        assertThat(out).contains("<p class=\"ql-align-right\">a</p>").contains("<img src=\"https://x.kr/a.png\">");
    }

    @Test
    void inlineImagesCountAsContent() {
        RichText.Result r = RichText.sanitize("<p><img src=\"data:image/png;base64,iVBORw0KGgo=\"></p>");
        assertThat(r.hasImage()).isTrue();
        assertThat(r.text()).isEmpty();
        assertThat(RichText.sanitize("<p><br></p>").text()).isBlank();
    }

    @Test
    void plainTextIsNotHtml() {
        assertThat(RichText.isHtml("  <p>a</p>")).isTrue();
        assertThat(RichText.isHtml("정기 점검 안내\n2시~4시")).isFalse();
        assertThat(RichText.isHtml(null)).isFalse();
    }
}
