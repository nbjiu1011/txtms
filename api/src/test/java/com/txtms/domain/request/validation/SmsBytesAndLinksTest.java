package com.txtms.domain.request.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class SmsBytesAndLinksTest {

    private static final String CC = "고객센터 1588-0000";
    private static final String OPT = "무료 수신거부 080-000-0000";

    @Test
    void asciiCountsOneAndOtherCodePointsTwo() {
        assertThat(SmsBytes.bytes("abc 123")).isEqualTo(7);
        assertThat(SmsBytes.bytes("한글")).isEqualTo(4);
        assertThat(SmsBytes.bytes("A한\n")).isEqualTo(4);
        // one code point (surrogate pair) counts 2, not 4
        assertThat(SmsBytes.bytes("😀")).isEqualTo(2);
        assertThat(SmsBytes.bytes(null)).isZero();
    }

    @Test
    void eucKrRepresentableCharactersAreKsX1001() {
        // the same strings are checked by the web counter (sms.test.ts) so both sides agree
        assertThat(SmsBytes.unsupported("abc 123 한글 가나다 ㄱ ① ※ € ® 漢字\n")).isEmpty();
        assertThat(SmsBytes.unsupported("똠방각하 😀 똠 뷁")).containsExactly("똠", "😀", "뷁");
        assertThat(SmsBytes.bytes("똠😀")).isEqualTo(4);
        assertThat(SmsBytes.unsupported(null)).isEmpty();
        assertThat(SmsBytes.encodable('A')).isTrue();
        assertThat(SmsBytes.encodable('한')).isTrue();
        assertThat(SmsBytes.encodable('똠')).isFalse();
        assertThat(SmsBytes.encodable(0xE000)).isFalse();
        assertThat(SmsBytes.encodable("😀".codePointAt(0))).isFalse();
    }

    @Test
    void channelSpecCountsCodePoints() {
        assertThat(ChannelSpecCheck.chars("a 😀\n가")).isEqualTo(5);
        assertThat(ChannelSpecCheck.chars(null)).isZero();
    }

    @Test
    void noticeLinesAreAppendedOnTheirOwnLine() {
        // "\n고객센터 1588-0000" = 1 + 8 + 1 + 9 = 19, "\n무료 수신거부 080-000-0000" = 27
        assertThat(SmsBytes.smsBytes("", true, false, CC, OPT)).isEqualTo(19);
        assertThat(SmsBytes.smsBytes("", false, true, CC, OPT)).isEqualTo(27);
        assertThat(SmsBytes.smsBytes("안녕", true, true, CC, OPT)).isEqualTo(4 + 19 + 27);
        assertThat(SmsBytes.smsBytes("안녕", false, false, CC, OPT)).isEqualTo(4);
    }

    @Test
    void linkMustBeHttpOrHttpsWithHost() {
        assertThat(Links.valid("https://hanbitcard.co.kr/event", Map.of())).isTrue();
        assertThat(Links.valid("http://a.kr", Map.of())).isTrue();
        assertThat(Links.valid("HTTPS://A.KR/x?y=1#z", Map.of())).isTrue();
        assertThat(Links.valid("ftp://a.kr", Map.of())).isFalse();
        assertThat(Links.valid("javascript:alert(1)", Map.of())).isFalse();
        assertThat(Links.valid("https://", Map.of())).isFalse();
        assertThat(Links.valid("hanbitcard.co.kr", Map.of())).isFalse();
        assertThat(Links.valid("https://a.kr/has space", Map.of())).isFalse();
        assertThat(Links.valid("", Map.of())).isFalse();
    }

    @Test
    void linkVariablesAreResolvedBeforeChecking() {
        Map<String, String> vars = Map.of("event_url", "https://hanbitcard.co.kr/e", "plain", "hello");
        assertThat(Links.valid("#{event_url}", vars)).isTrue();
        assertThat(Links.valid("https://a.kr/#{plain}", vars)).isTrue();
        assertThat(Links.valid("#{plain}", vars)).isFalse();
        assertThat(Links.valid("#{unknown}", vars)).isFalse();
    }

    @Test
    void variableTokensInOrderWithoutDuplicates() {
        assertThat(VariableTokens.keys("#{a} 님 #{b_1} #{a}")).containsExactly("a", "b_1");
        assertThat(VariableTokens.keys("none")).isEmpty();
        assertThat(VariableTokens.resolve("#{a}-#{x}", Map.of("a", "1"))).isEqualTo("1-#{x}");
        assertThat(VariableTokens.contains("{\"body\":\"#{points}\"}", "points")).isTrue();
        assertThat(VariableTokens.contains("{\"body\":\"#{points}\"}", "point")).isFalse();
    }
}
