package com.txtms.domain.correction.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** The rules of the engine specification V0.5 one by one (actions.md §6.7 and its comparison table). */
class CorrectionEngineTest {

    private static CorrectionRule expr(String id, String original, String recommended) {
        return new CorrectionRule(id, original, recommended, null, null, "라벨 " + id, "설명 " + id);
    }

    private static CorrectionRule pattern(String id, String original, String recommended) {
        return new CorrectionRule(id, null, null, original, recommended, "라벨 " + id, "설명 " + id);
    }

    private static List<String> run(String text, CorrectionRule... rules) {
        return run(Duration.ofSeconds(2), text, rules);
    }

    private static List<String> run(Duration timeout, String text, CorrectionRule... rules) {
        return CorrectionEngine.compile(Arrays.asList(rules), timeout).run(text).stream()
                .map(f -> f.start() + ":" + f.end() + " " + f.matchedText() + " " + f.options().stream()
                        .map(o -> o.ruleId() + "=" + (o.recommended() == null ? "∅" : o.recommended())).toList())
                .toList();
    }

    @Test
    void specScenarioOfTheEngineDocument() {
        // 교정엔진 동작 명세서 V0.5, "교정엔진 동작 시나리오" (rules 1–10; the date rules are as written in the document)
        String text = "가입 대상은 본인과 배우자, 자녀 및 손자 또는 손녀까지이며, 2026-7-7부터 가입할 수 있습니다. 보험금은 喪으로 인한 장례비를 "
                + "보장 받겠지만, 담보에 대한 세부 지급 기준은 약관을 확인하시기 바랍니다. (1.238%)";
        CorrectionRule[] rules = {
                expr("1", "손자", "손자 또는 손녀"), expr("2", "喪", "상"), expr("3", "담보", "보장"),
                expr("4", "보장 받겠지만", "보장받겠지만"), expr("5", "가입 대상", "가입대상"),
                expr("6", "가입 대상", "가입 가능한 분"),
                pattern("7", "(\\d{4})\\s*[./-]\\s*(\\d{2})\\s*[./-]\\s*(\\d{2})", "\\1.\\2.\\3"),
                pattern("8", "(\\d{4})\\s*[./-]\\s*(\\d{1})\\s*[./-]\\s*(\\d{2})", "20\\1.0\\2.\\3"),
                expr("9", "금일", "오늘"), pattern("10", "평균\\s*소득\\s*월액", "평균소득월액")};
        int mourning = text.indexOf("喪");
        int guarantee = text.indexOf("보장 받겠지만");
        int collateral = text.indexOf("담보");
        assertThat(run(text, rules)).containsExactly(
                "0:5 가입 대상 [5=가입대상, 6=가입 가능한 분]",
                mourning + ":" + (mourning + 1) + " 喪 [2=상]",
                guarantee + ":" + (guarantee + 7) + " 보장 받겠지만 [4=보장받겠지만]",
                collateral + ":" + (collateral + 2) + " 담보 [3=보장]");
        // The document lists "2026-7-7 → 2026.07.07" for rule 8, but its pattern needs a two-digit day and its
        // replacement would prefix "20" again; the engine runs the pattern as written (no match). A pattern that
        // fits the example shows the \N references at work:
        assertThat(run("2026-7-7부터",
                pattern("8b", "(\\d{4})\\s*[./-]\\s*(\\d{1,2})\\s*[./-]\\s*(\\d{1,2})(?!\\d)", "\\1.0\\2.0\\3")))
                .containsExactly("0:8 2026-7-7 [8b=2026.07.07]");
    }

    @Test
    void blankTextIsNotRun() {
        CorrectionRule space = expr("1", " ", "_");
        assertThat(run("", space)).isEmpty();
        assertThat(run("   \n\t", space)).isEmpty();
        assertThat(run(null, space)).isEmpty();
    }

    @Test
    void longerMatchHidesContainedCandidatesButSameSpansStay() {
        assertThat(run("보장 받겠지만", expr("3", "담보", "보장"), expr("4", "보장 받겠지만", "보장받겠지만")))
                .containsExactly("0:7 보장 받겠지만 [4=보장받겠지만]");
        assertThat(run("가입대상", expr("a", "가입대상", "가입 대상"), expr("b", "가입대상", "가입 가능한 분")))
                .containsExactly("0:4 가입대상 [a=가입 대상, b=가입 가능한 분]");
    }

    @Test
    void recommendedExpressionProtectsOnlyWhenLonger() {
        // [P] hid "Y→Z" inside a recommended "Y"; [D] keeps both same-span candidates and hides only the Y row
        assertThat(run("Y", expr("A", "X", "Y"), expr("B", "Y", "Z"))).containsExactly("0:1 Y [B=Z]");
        assertThat(run("손자 또는 손녀", expr("1", "손자", "손자 또는 손녀"))).isEmpty();
        assertThat(run("손자", expr("1", "손자", "손자 또는 손녀"))).containsExactly("0:2 손자 [1=손자 또는 손녀]");
    }

    @Test
    void partiallyOverlappingCandidatesAreAllShown() {
        assertThat(run("ABC", expr("1", "AB", "x"), expr("2", "BC", "y")))
                .containsExactly("0:2 AB [1=x]", "1:3 BC [2=y]");
        assertThat(run("안되요", expr("P2", "안되", "안 되"), expr("P1", "되요", "돼요")))
                .containsExactly("0:2 안되 [P2=안 되]", "1:3 되요 [P1=돼요]");
    }

    @Test
    void sameExpressionIsHiddenCaseSensitively() {
        assertThat(run("foo", expr("1", "foo", "foo"))).isEmpty();
        assertThat(run("Foo", expr("1", "Foo", "foo"))).containsExactly("0:3 Foo [1=foo]");
        assertThat(run("ab", pattern("1", "(a)(b)", "$1$2"))).isEmpty();
    }

    @Test
    void matchingIsCaseSensitive() {
        assertThat(run("Day day DAY", expr("31", "Day", "일"))).containsExactly("0:3 Day [31=일]");
        assertThat(run("day", pattern("p", "Day", "일"))).isEmpty();
    }

    @Test
    void descriptionOnlyRulesHaveNoRecommendation() {
        assertThat(run("처리합니다", expr("43", "처리", "-"))).containsExactly("0:2 처리 [43=∅]");
        assertThat(run("처리합니다", expr("43", "처리", null))).containsExactly("0:2 처리 [43=∅]");
        assertThat(run("처리합니다", expr("43", "처리", "  "))).containsExactly("0:2 처리 [43=∅]");
        assertThat(run("1일자", pattern("46", "(?<!당)일자(?!리)", "-"))).containsExactly("1:3 일자 [46=∅]");
        // "-" is not a protector: a "-" in the text is not hidden or protected
        assertThat(run("a-b", expr("x", "-", "–"), expr("y", "처리", "-"))).containsExactly("1:2 - [x=–]");
    }

    @Test
    void groupReferencesAcceptDollarAndBackslash() {
        assertThat(run("휴대폰이 없습니다", pattern("2", "휴대폰이([^가-힣]|$)", "휴대전화 번호가$1")))
                .containsExactly("0:5 휴대폰이  [2=휴대전화 번호가 ]");
        assertThat(run("휴대폰이", pattern("2", "휴대폰이([^가-힣]|$)", "휴대전화 번호가\\1")))
                .containsExactly("0:4 휴대폰이 [2=휴대전화 번호가]");
        assertThat(run("첫번째", pattern("28", "([가-힣])번째", "$1 번째"))).containsExactly("0:3 첫번째 [28=첫 번째]");
        // $0 is the whole match; a $ or \ without a digit is literal
        assertThat(run("ab", pattern("w", "ab", "[$0] $x \\y"))).containsExactly("0:2 ab [w=[ab] $x \\y]");
        // unmatched optional group expands to nothing
        assertThat(run("ac", pattern("o", "a(b)?c", "x$1y"))).containsExactly("0:2 ac [o=xy]");
    }

    @Test
    void groupNumbersAreReadLikeJava() {
        String twelve = "(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)";
        assertThat(run("abcdefghijkl", pattern("g", twelve, "$12|$13")))
                .containsExactly("0:12 abcdefghijkl [g=l|a3]");
    }

    @Test
    void invalidRulesAreRejectedByValidateAndSkippedByCompile() {
        assertThatThrownBy(() -> CorrectionEngine.validate(pattern("1", "(", "x")))
                .hasMessageStartingWith("original_pattern 정규식 오류");
        assertThatThrownBy(() -> CorrectionEngine.validate(pattern("1", "(a)", "$2")))
                .hasMessage("recommended_pattern이 없는 그룹 $2을(를) 참조합니다");
        assertThatThrownBy(() -> CorrectionEngine.validate(new CorrectionRule("1", "a", null, "b", null, null, null)))
                .hasMessage("original_expr와 original_pattern 중 하나만 입력하세요");
        assertThatThrownBy(() -> CorrectionEngine.validate(new CorrectionRule("1", null, null, " ", null, null, null)))
                .hasMessage("original_expr와 original_pattern 중 하나만 입력하세요");
        assertThatThrownBy(() -> CorrectionEngine.validate(new CorrectionRule("1", "a", null, null, "b", null, null)))
                .hasMessage("original_expr 규칙의 권장 값은 recommended_expr에 입력하세요");
        assertThatThrownBy(() -> CorrectionEngine.validate(new CorrectionRule("1", null, "b", "a", null, null, null)))
                .hasMessage("original_pattern 규칙의 권장 값은 recommended_pattern에 입력하세요");
        CorrectionEngine engine = CorrectionEngine.compile(List.of(pattern("bad", "(", "x"), expr("ok", "a", "b")),
                Duration.ofSeconds(1));
        assertThat(engine.ruleCount()).isEqualTo(1);
        assertThat(engine.run("a")).hasSize(1);
    }

    @Test
    void javaPatternWithoutUnicodeCharacterClasses() {
        assertThat(run("123 ١٢٣", pattern("d", "\\d+", "#"))).containsExactly("0:3 123 [d=#]");
        assertThat(run("가나 다", pattern("w", "\\w+", "#"))).isEmpty();
        assertThat(run("10월 20일", pattern("lb", "(?<=월 )\\d+(?=일)", "<$0>"))).containsExactly("4:6 20 [lb=<20>]");
        assertThat(run("신고해 주세요", pattern("45", "^신고해 *주세요$", "신고하기")))
                .containsExactly("0:7 신고해 주세요 [45=신고하기]");
        assertThat(run("꼭 신고해 주세요", pattern("45", "^신고해 *주세요$", "신고하기"))).isEmpty();
    }

    @Test
    void occurrencesDoNotOverlapAndZeroLengthMatchesAreIgnored() {
        assertThat(run("aaa", expr("1", "aa", "b"))).containsExactly("0:2 aa [1=b]");
        assertThat(run("aaaa", pattern("1", "aa", "b"))).containsExactly("0:2 aa [1=b]", "2:4 aa [1=b]");
        assertThat(run("abc", pattern("z", "x*", "y"))).isEmpty();
    }

    @Test
    void indicesAreUtf16CodeUnits() {
        assertThat(run("😀 적립 되요", expr("P1", "되요", "돼요"))).containsExactly("6:8 되요 [P1=돼요]");
    }

    @Test
    void expressionsKeepTheirSpaces() {
        assertThat(run("서울 별 다방", expr("29", " 별 ", "별 "))).containsExactly("2:5  별  [29=별 ]");
        assertThat(run("가입 시 혜택", expr("42", " 시 ", " 할 때 "), expr("41", "時", "시")))
                .containsExactly("2:5  시  [42= 할 때 ]");
    }

    @Test
    void optionsFollowDatasetOrder() {
        assertThat(run("소요됩니다", expr("27", "소요됩니다", "걸립니다"), expr("26", "소요됩니다", "필요합니다")))
                .containsExactly("0:5 소요됩니다 [27=걸립니다, 26=필요합니다]");
    }

    @Test
    void slowPatternsAreCutOff() {
        String text = "a".repeat(40) + "!";
        long started = System.nanoTime();
        assertThat(run(Duration.ofMillis(50), text, pattern("redos", "(a+)+b", "x"), expr("ok", "!", "?")))
                .containsExactly("40:41 ! [ok=?]");
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    void replacementTemplateNormalization() {
        assertThat(ReplacementTemplate.normalize("\\1.\\2.\\3")).isEqualTo("$1.$2.$3");
        assertThat(ReplacementTemplate.normalize("20\\1 \\x $2")).isEqualTo("20$1 \\x $2");
        assertThat(ReplacementTemplate.normalize(null)).isNull();
    }
}
