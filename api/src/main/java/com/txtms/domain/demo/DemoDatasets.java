package com.txtms.domain.demo;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ClassPathResource;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.correction.service.DatasetRuleValidator;
import com.txtms.domain.correction.service.DatasetXlsxReader;

/**
 * Demo correction datasets and assignments (shared by the empty-database seed and the dev refresh).
 * <ul>
 * <li>Every content type gets one dataset: the client sample dataset ({@code docs/교정엔진 샘플 데이터셋.xlsx}, copied to
 * {@code resources/demo/correction-sample-dataset.xlsx}; it is not type specific, so all 48 rows go to every type)
 * followed by the prototype rules: the common ones (P1–P6) and the type's own (alimtalk P7–P8, SMS P9, RCS P10,
 * free-form P11).</li>
 * <li>Assignments: 한빛카드 all four types (confirmed); 도담생명 alimtalk (confirmed), SMS and RCS (not confirmed);
 * 도담생명 free-form is left unassigned to demonstrate {@code DATASET_NOT_ASSIGNED}.</li>
 * </ul>
 */
public final class DemoDatasets {

    static final String SAMPLE_RESOURCE = "demo/correction-sample-dataset.xlsx";

    /** One planned assignment of a demo customer (by domain). */
    public record PlannedAssignment(String customerDomain, ContentType type, boolean confirmed) {
    }

    public static final String HANBIT = "hanbitcard.co.kr";
    public static final String DODAM = "dodamlife.com";

    public static final List<PlannedAssignment> ASSIGNMENTS = List.of(
            new PlannedAssignment(HANBIT, ContentType.ALIMTALK, true),
            new PlannedAssignment(HANBIT, ContentType.SMS, true),
            new PlannedAssignment(HANBIT, ContentType.RCS, true),
            new PlannedAssignment(HANBIT, ContentType.FREEFORM, true),
            new PlannedAssignment(DODAM, ContentType.ALIMTALK, true),
            new PlannedAssignment(DODAM, ContentType.SMS, false),
            new PlannedAssignment(DODAM, ContentType.RCS, false));

    private static final String SPACING = "띄어쓰기";

    /** Prototype rules shared by every type (H:586–597), with the engine's label and description columns. */
    private static final List<CorrectionRule> COMMON = List.of(
            rule("P1", "되요", "돼요", "한글 맞춤법 준수",
                    "'되어요'의 준말은 '돼요'입니다. '되요'로 쓰지 않습니다."),
            rule("P2", "안되", "안 되", SPACING,
                    "부정의 '안'은 뒤의 용언과 띄어 씁니다. 예) 안 돼요, 안 됩니다"),
            rule("P3", "할수", "할 수", SPACING, "의존 명사 '수'는 앞말과 띄어 씁니다. 예) 할 수 있습니다"),
            rule("P4", "될수", "될 수", SPACING, "의존 명사 '수'는 앞말과 띄어 씁니다. 예) 될 수 있습니다"),
            rule("P5", "금일", "오늘", "어려운 한자어", "어려운 한자어 대신 쉬운 우리말을 씁니다."),
            rule("P6", "익일", "다음 날", "어려운 한자어", "어려운 한자어 대신 쉬운 우리말을 씁니다."));

    private static final Map<ContentType, List<CorrectionRule>> OWN = Map.of(
            ContentType.ALIMTALK, List.of(
                    rule("P7", "클릭", "선택", "권장 표현",
                            "버튼 안내는 기기와 무관한 '선택'으로 씁니다. 예) 아래 버튼을 선택하세요"),
                    rule("P8", "혜택을 드립니다", "혜택을 받으실 수 있습니다", "권장 표현",
                            "고객이 주어가 되도록 씁니다. 회사가 베푸는 표현 대신 고객이 받는 표현을 씁니다.")),
            ContentType.SMS, List.of(
                    rule("P9", "무료수신거부", "무료 수신거부", SPACING, "광고 문자의 수신거부 안내는 '무료 수신거부'로 띄어 씁니다.")),
            ContentType.RCS, List.of(
                    rule("P10", "자세히보기", "자세히 보기", SPACING, "'보기'는 앞말과 띄어 씁니다. 예) 자세히 보기")),
            ContentType.FREEFORM, List.of(
                    rule("P11", "하였습니다", "했습니다", "간결한 표현", "'하였습니다'보다 짧은 '했습니다'를 씁니다.")));

    private DemoDatasets() {
    }

    /** The validated demo rules of a content type (sample dataset first, then the prototype rules). */
    public static List<CorrectionRule> rules(ContentType type) {
        List<DatasetRuleValidator.Row> rows = new ArrayList<>(sampleRows());
        int n = 1000;
        List<CorrectionRule> extra = new ArrayList<>(COMMON);
        extra.addAll(OWN.get(type));
        for (CorrectionRule r : extra) {
            rows.add(new DatasetRuleValidator.Row(n++, r.ruleId(), r.originalExpr(), r.recommendedExpr(),
                    r.originalPattern(), r.recommendedPattern(), r.descriptionLabel(), r.description()));
        }
        return DatasetRuleValidator.validate(rows, 5000);
    }

    private static List<DatasetRuleValidator.Row> sampleRows() {
        try (InputStream in = new ClassPathResource(SAMPLE_RESOURCE).getInputStream()) {
            return DatasetXlsxReader.read(in, 5000);
        } catch (IOException e) {
            throw new UncheckedIOException("demo sample dataset missing: " + SAMPLE_RESOURCE, e);
        }
    }

    private static CorrectionRule rule(String id, String original, String recommended, String label,
            String description) {
        return new CorrectionRule(id, original, recommended, null, null, label, description);
    }
}
