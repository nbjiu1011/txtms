package com.txtms.domain.correction.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Every scenario of {@code docs/텍스트 교정 테스트 케이스&시나리오_260714.xlsx} run against the client sample dataset
 * ({@code docs/교정엔진 샘플 데이터셋.xlsx}, 48 rules). Expectations follow the engine specification V0.5 (actions.md
 * §6.7); white rows of the sheet must be shown, grey rows must not. Where the sheet and the specification disagree
 * the specification wins and the case says so ({@code note}).
 */
class CorrectionScenarioTest {

    private static final CorrectionEngine ENGINE = CorrectionEngine.compile(SampleDataset.rules(),
            Duration.ofSeconds(2));

    /** Expected finding: the matched text, which occurrence of it (0-based), and "ruleId=recommended" options. */
    record Exp(String matched, int occurrence, List<String> options) {
    }

    static Exp exp(String matched, String... options) {
        return new Exp(matched, 0, List.of(options));
    }

    static Exp exp(String matched, int occurrence, String... options) {
        return new Exp(matched, occurrence, List.of(options));
    }

    static List<Exp> none() {
        return List.of();
    }

    static final String T10 = "본인 명의의 휴대폰을 입력하여 주시기 바랍니다.\n본인 명의의 휴대폰이 아닌 경우 신청 불가능합니다.";
    static final String T12 = "카드 발송은 영업일 기준 일주일 이상 소요됩니다.\n신청자 본인이 카드를 직접 수령하면 사용 등록없이 바로 사용이 가능합니다."
            + "\n사용 시작 전 카드 서명을 꼭 하시기 바랍니다.";
    static final String T_B8 = "우대 이자률은 만기 해지시에 보장 받겠지만 중도 해지시 중도해지 이자률로 처리됩니다.\n중도해지 시 이자률은 약정한 이자률 보다 "
            + "낮으므로 유의해 주세요.\n2천만원이하의 원금은 ‘소비자보호법’에 따라 보호됩니다.";

    static Stream<Arguments> scenarios() {
        return Stream.of(
                // ---- sheet section 1 (text_id 1–12)
                Arguments.of("A1 장음절 우선: 권장 '해주세요'를 품은 기존 패턴", "신고해주세요",
                        List.of(exp("신고해주세요", "45=신고하기")), "33·8·32 후보는 더 긴 45에 포함되어 제외"),
                Arguments.of("A2 1:N 가입 대상 (치환·교체 인덱스는 oneToManySwitchAndRestore)", "가입 대상인지 아닌지 확인",
                        List.of(exp("가입 대상", "13=가입대상", "14=가입 가능한 분")), "10 '상'(권장 보호)은 포함되어 제외"),
                Arguments.of("A3 작은 따옴표 1건", "작은 따옴표", List.of(exp("작은 따옴표", "17=작은따옴표")), ""),
                Arguments.of("A4 권장 표현은 교정으로 뜨지 않음", "오발송될 수 있으니 주소가 변경되었다면 고지해주세요.", none(),
                        "33 '세요'는 권장 표현 탐지(isSameExpr)로 숨김, 8은 매칭 없음"),
                Arguments.of("A5 따로 쓰인 부기", "부기", List.of(exp("부기", "34=덧붙여 적음", "35=덧붙여 적힘")), ""),
                Arguments.of("A6 납부기한 안의 부기 제외", "납부기한", List.of(exp("납부기한", "36=납부일", "37=납부해야 되는 날")),
                        "34·35는 포함되어 제외"),
                Arguments.of("A7 권장 '시' 숨김", "서울시 서초구 명달로 43, 301호", none(), "41 '시'는 권장 표현 → 숨김"),
                Arguments.of("A8 1:N 수령인", "수령인 성함", List.of(exp("수령인", "18=받는 사람", "19=받는 분")), ""),
                Arguments.of("A9 휴대폰 단독", "휴대폰 입력", List.of(exp("휴대폰", "1=휴대전화 번호")), ""),
                Arguments.of("A10 조사 변형 패턴·뒤 공백 유지·장음절 우선", T10,
                        List.of(exp("휴대폰을 ", "3=휴대전화 번호를 "), exp("하여 주시기 바랍니다", "8=해주세요"),
                                exp("휴대폰이 ", "2=휴대전화 번호가 ")),
                        "1·32·33·41은 포함되어 제외"),
                Arguments.of("A11 권장 표현만 있는 문장", "확인해주세요!", none(), "33 '세요' 숨김"),
                Arguments.of("A12 1:N 소요됩니다·이 가능합니다·시기 바랍니다", T12,
                        List.of(exp("소요됩니다", "26=필요합니다", "27=걸립니다"),
                                exp("이 가능합니다", "21=이할 수 있습니다", "22=이을 할 수 있습니다", "23=이를 할 수 있습니다",
                                        "24=을 할 수 있습니다", "25=를 할 수 있습니다"),
                                exp("시기 바랍니다", "33=세요")),
                        "시트는 24·25만 적었지만 패턴 21–23도 같은 구간 '이 가능합니다'에 매칭되므로 명세대로 같은 그룹(1:N)에 함께 노출"),
                // ---- sheet section 2 (text_id 1–15)
                Arguments.of("B1 약대", "약대 신청", List.of(exp("약대", "38=보험계약대출")), ""),
                Arguments.of("B2 권장 표현 안의 약대", "보험계약대출", none(), "38은 권장 표현 구간에 포함되어 제외"),
                Arguments.of("B3 손자 / 손자 또는 손녀", "손자라고 쓰지말고 손자 또는 손녀라고 쓰세요",
                        List.of(exp("손자", 0, "9=손자 또는 손녀")), "두 번째 손자는 권장 표현 구간에 포함되어 제외"),
                Arguments.of("B4 정규식 그룹 치환", "OO은행 첫번째 적금", List.of(exp("첫번째", "28=첫 번째")), ""),
                Arguments.of("B5 이메일", "이메일", none(), "39·31은 제외"),
                Arguments.of("B6 첫번째 보장", "첫번째 보장일", List.of(exp("첫번째 보장", "44=첫 보장")), "28·31 제외"),
                Arguments.of("B7 당일자", "당일자 지급 금액", none(), "46은 (?<!당)으로 매칭 없음, 31 '일' 숨김"),
                Arguments.of("B8–B13 한 레이어의 중복·조사 패턴·설명만", T_B8,
                        List.of(exp("이자률", 0, "47=이자율"), exp("해지시에", "48=해지 시에"),
                                exp("보장 받겠지만", "12=보장받겠지만"), exp("해지시 ", "48=해지 시 "),
                                exp("이자률", 1, "47=이자율"), exp("처리", "43=∅"), exp(" 시 ", "42= 할 때 "),
                                exp("이자률", 2, "47=이자율"), exp("이자률", 3, "47=이자율")),
                        "시트는 42를 회색으로 두었으나 본문에서 ' 시 '를 굵게 표시했고 명세상 포함 관계가 없어 노출. "
                                + "15 '소비자보호법'은 데이터셋이 곧은 따옴표(')이고 본문이 둥근 따옴표(‘’)라 문자열 일치 없음 "
                                + "→ straightQuotesMatchRule15"),
                Arguments.of("B14 대소문자 구분", "Day by day, D DAY",
                        List.of(exp("Day", "30=날짜", "31=일")), "30도 같은 기존 표현 Day라 같은 그룹(시트는 31만 표기)"),
                Arguments.of("B15 lookbehind·lookahead, 권장 없음", "당일자는 잡히면 안되고 1일자는 잡히고 일자리는 안됨",
                        List.of(exp("일자", 1, "46=∅")), "당일자·일자리는 제외, 46은 권장 값이 없어 설명만"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("scenarios")
    void scenario(String name, String text, List<Exp> expected, String note) {
        assertThat(render(text, ENGINE.run(text))).as(note).containsExactlyElementsOf(expected(text, expected));
    }

    @Test
    void straightQuotesMatchRule15() {
        String text = "2천만원이하의 원금은 '소비자보호법'에 따라 보호됩니다.";
        assertThat(render(text, ENGINE.run(text)))
                .containsExactly(expected(text, List.of(exp("'소비자보호법'", "15=「소비자보호법」"))).getFirst());
    }

    @Test
    void sampleDatasetHas48Rules() {
        assertThat(SampleDataset.rules()).hasSize(48);
        assertThat(ENGINE.ruleCount()).isEqualTo(48);
        assertThat(SampleDataset.rules().getLast().ruleId()).isEqualTo("48");
        assertThat(SampleDataset.rules().get(28).originalExpr()).isEqualTo(" 별 ");
        assertThat(SampleDataset.rules().get(42).recommendedExpr()).isNull();
    }

    /**
     * Cases 2, 8 and 12: replace with one option, switch to the other option, restore. The group keeps its start;
     * its end follows the applied text, and later groups of the same field move by the length difference.
     */
    @Test
    void oneToManySwitchAndRestore() {
        switchAndRestore("가입 대상인지 아닌지 확인", "가입 대상", "가입대상", "가입 가능한 분");
        switchAndRestore("수령인 성함", "수령인", "받는 사람", "받는 분");
        switchAndRestore(T12, "소요됩니다", "필요합니다", "걸립니다");
    }

    private static void switchAndRestore(String text, String matched, String first, String second) {
        List<Finding> findings = ENGINE.run(text);
        Finding group = findings.stream().filter(f -> f.matchedText().equals(matched)).findFirst().orElseThrow();
        assertThat(group.options()).extracting(Finding.Option::recommended).contains(first, second);
        List<Finding> later = findings.stream().filter(f -> f.start() >= group.end()).toList();

        String applied = replace(text, group.start(), group.end(), first);
        assertThat(applied.substring(group.start(), group.start() + first.length())).isEqualTo(first);
        assertShifted(applied, later, first.length() - matched.length());
        assertThat(ENGINE.run(applied)).noneMatch(f -> f.start() == group.start() && f.matchedText().equals(first));

        String switched = replace(applied, group.start(), group.start() + first.length(), second);
        assertThat(switched).isEqualTo(replace(text, group.start(), group.end(), second));
        assertShifted(switched, later, second.length() - matched.length());

        String restored = replace(switched, group.start(), group.start() + second.length(), matched);
        assertThat(restored).isEqualTo(text);
    }

    private static void assertShifted(String text, List<Finding> later, int delta) {
        for (Finding f : later) {
            assertThat(text.substring(f.start() + delta, f.end() + delta)).isEqualTo(f.matchedText());
        }
    }

    private static String replace(String text, int start, int end, String with) {
        return text.substring(0, start) + with + text.substring(end);
    }

    static List<String> render(String text, List<Finding> findings) {
        List<String> out = new ArrayList<>();
        for (Finding f : findings) {
            assertThat(text.substring(f.start(), f.end())).isEqualTo(f.matchedText());
            out.add(line(f.matchedText(), f.start(), f.options().stream()
                    .map(o -> o.ruleId() + "=" + (o.recommended() == null ? "∅" : o.recommended())).toList()));
        }
        return out;
    }

    static List<String> expected(String text, List<Exp> exps) {
        List<String> out = new ArrayList<>();
        for (Exp e : exps) {
            int start = -1;
            for (int i = 0; i <= e.occurrence(); i++) {
                start = text.indexOf(e.matched(), start + 1);
            }
            assertThat(start).as("occurrence %d of %s", e.occurrence(), e.matched()).isGreaterThanOrEqualTo(0);
            out.add(line(e.matched(), start, e.options()));
        }
        return out;
    }

    private static String line(String matched, int start, List<String> options) {
        return "[" + matched + "]@" + start + " " + options;
    }
}
