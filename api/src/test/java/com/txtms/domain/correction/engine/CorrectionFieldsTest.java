package com.txtms.domain.correction.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.demo.DemoDatasets;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Checked text fields per content type, free-form exclusion, event field keys, and the demo datasets. */
class CorrectionFieldsTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private JsonNode tree(String s) {
        return json.readTree(s);
    }

    private static List<String> keys(List<CorrectionFields.Field> fields) {
        return fields.stream().map(f -> f.key() + "=" + f.text()).toList();
    }

    @Test
    void fieldsPerType() {
        assertThat(keys(CorrectionFields.of(ContentType.ALIMTALK, tree(
                "{\"templateCode\":\"T\",\"body\":\"본문\",\"buttons\":[{\"name\":\"자세히\",\"link\":\"https://a\"},"
                        + "{\"name\":\"\",\"link\":\"\"}]}"))))
                .containsExactly("body=본문", "buttons.0.name=자세히", "buttons.1.name=");
        assertThat(keys(CorrectionFields.of(ContentType.SMS, tree(
                "{\"sender\":\"1588\",\"body\":\"문자\",\"customerCenter\":true,\"optOut\":true}"))))
                .containsExactly("body=문자");
        assertThat(keys(CorrectionFields.of(ContentType.RCS, tree(
                "{\"cards\":[{\"title\":\"제목1\",\"body\":\"본문1\",\"buttonName\":\"보기\"},{\"title\":\"\",\"body\":\"본문2\"}]}"))))
                .containsExactly("cards.0.title=제목1", "cards.0.body=본문1", "cards.1.title=", "cards.1.body=본문2");
        assertThat(keys(CorrectionFields.of(ContentType.FREEFORM, tree("{\"title\":\"고지\",\"text\":\"내용\"}"))))
                .containsExactly("title=고지", "text=내용");
    }

    @Test
    void eventFieldKeys() {
        assertThat(CorrectionFields.validKey(ContentType.ALIMTALK, "body")).isTrue();
        assertThat(CorrectionFields.validKey(ContentType.ALIMTALK, "buttons.4.name")).isTrue();
        assertThat(CorrectionFields.validKey(ContentType.ALIMTALK, "buttons.0.link")).isFalse();
        assertThat(CorrectionFields.validKey(ContentType.SMS, "sender")).isFalse();
        assertThat(CorrectionFields.validKey(ContentType.RCS, "cards.1.body")).isTrue();
        assertThat(CorrectionFields.validKey(ContentType.RCS, "cards.1.buttonName")).isFalse();
        assertThat(CorrectionFields.validKey(ContentType.FREEFORM, "text")).isTrue();
        assertThat(CorrectionFields.validKey(ContentType.FREEFORM, "body")).isFalse();
        assertThat(CorrectionFields.validKey(ContentType.FREEFORM, null)).isFalse();
    }

    @Test
    void demoDatasetsCombineTheSampleAndThePrototypeRules() {
        List<CorrectionRule> alimtalk = DemoDatasets.rules(ContentType.ALIMTALK);
        assertThat(alimtalk).hasSize(48 + 6 + 2);
        assertThat(alimtalk.getFirst().ruleId()).isEqualTo("1");
        assertThat(alimtalk.stream().map(CorrectionRule::ruleId)).contains("P1", "P7", "P8").doesNotContain("P9");
        assertThat(DemoDatasets.rules(ContentType.SMS)).hasSize(55).anyMatch(r -> r.ruleId().equals("P9"));
        // RCS is deferred from Phase 1: no demo dataset type, no RCS rule
        assertThat(DemoDatasets.TYPES).containsExactly(ContentType.ALIMTALK, ContentType.SMS, ContentType.FREEFORM);
        assertThat(DemoDatasets.ASSIGNMENTS).noneMatch(a -> a.type() == ContentType.RCS);
        assertThat(DemoDatasets.rules(ContentType.RCS)).noneMatch(r -> r.ruleId().equals("P10"));
        assertThat(DemoDatasets.rules(ContentType.FREEFORM)).anyMatch(r -> r.ruleId().equals("P11"));

        // demo request REQ-2609-101 C1 shows results
        CorrectionEngine engine = CorrectionEngine.compile(alimtalk, Duration.ofSeconds(1));
        String body = "#{customer_name}님, 10월 한 달 동안 결제하시면 최대 #{points} 포인트가 적립 되요.\n\n"
                + "이벤트 기간: #{event_period}\n아래 버튼을 클릭하세요.";
        assertThat(engine.run(body)).extracting(Finding::matchedText).containsExactly("되요", "클릭");
        assertThat(engine.run(body).getFirst().options().getFirst().descriptionLabel()).isEqualTo("한글 맞춤법 준수");
    }
}
