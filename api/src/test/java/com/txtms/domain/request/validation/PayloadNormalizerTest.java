package com.txtms.domain.request.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class PayloadNormalizerTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final PayloadNormalizer normalizer = new PayloadNormalizer(new PayloadNormalizer.Caps(10_000, 20, 5));

    private JsonNode tree(String s) {
        return json.readTree(s);
    }

    @Test
    void blankPayloadsPerType() {
        assertThat(json.writeValueAsString(PayloadNormalizer.blank(ContentType.ALIMTALK)))
                .isEqualTo("{\"templateCode\":\"\",\"body\":\"\",\"buttons\":[]}");
        assertThat(json.writeValueAsString(PayloadNormalizer.blank(ContentType.SMS)))
                .isEqualTo("{\"sender\":\"\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}");
        assertThat(PayloadNormalizer.blank(ContentType.RCS).path("cards")).hasSize(1);
        assertThat(PayloadNormalizer.blank(ContentType.RCS).path("cards").get(0).get("imageKey").isNull()).isTrue();
        assertThat(json.writeValueAsString(PayloadNormalizer.blank(ContentType.FREEFORM)))
                .isEqualTo("{\"title\":\"\",\"text\":\"\"}");
    }

    @Test
    void draftInProgressIsAcceptedAndCompletedWithDefaults() {
        JsonNode n = normalizer.normalize(ContentType.ALIMTALK, tree("{\"body\":\"작성 중\",\"buttons\":[{\"name\":\"\"}]}"));
        assertThat(json.writeValueAsString(n)).isEqualTo(
                "{\"templateCode\":\"\",\"body\":\"작성 중\",\"buttons\":[{\"name\":\"\",\"link\":\"\"}]}");
        JsonNode sms = normalizer.normalize(ContentType.SMS, tree("{\"body\":null,\"optOut\":true}"));
        assertThat(sms.path("body").asString()).isEmpty();
        assertThat(sms.path("optOut").asBoolean()).isTrue();
        assertThat(sms.path("customerCenter").asBoolean()).isFalse();
        JsonNode rcs = normalizer.normalize(ContentType.RCS, tree("{\"cards\":[{\"title\":\"t\",\"imageKey\":\"\"}]}"));
        assertThat(rcs.path("cards").get(0).get("imageKey").isNull()).isTrue();
        assertThat(PayloadNormalizer.imageKeys(normalizer.normalize(ContentType.RCS,
                tree("{\"cards\":[{\"imageKey\":\"img_1\"},{}]}")))).containsExactly("img_1");
    }

    @Test
    void unknownKeysAndWrongTypesAreRejected() {
        assertCode(() -> normalizer.normalize(ContentType.SMS, tree("{\"tpl\":\"x\"}")), ErrorCode.VALIDATION_FAILED,
                "payload.tpl");
        assertCode(() -> normalizer.normalize(ContentType.SMS, tree("{\"body\":3}")), ErrorCode.VALIDATION_FAILED,
                "payload.body");
        assertCode(() -> normalizer.normalize(ContentType.SMS, tree("{\"optOut\":\"Y\"}")),
                ErrorCode.VALIDATION_FAILED, "payload.optOut");
        assertCode(() -> normalizer.normalize(ContentType.ALIMTALK, tree("{\"buttons\":{}}")),
                ErrorCode.VALIDATION_FAILED, "payload.buttons");
        assertCode(() -> normalizer.normalize(ContentType.ALIMTALK, tree("{\"buttons\":[{\"n\":\"a\"}]}")),
                ErrorCode.VALIDATION_FAILED, "payload.buttons.0.n");
        assertCode(() -> normalizer.normalize(ContentType.RCS, tree("{\"cards\":[1]}")), ErrorCode.VALIDATION_FAILED,
                "payload.cards.0");
        assertCode(() -> normalizer.normalize(ContentType.FREEFORM, tree("[]")), ErrorCode.VALIDATION_FAILED,
                "payload");
        assertCode(() -> normalizer.normalize(ContentType.FREEFORM, null), ErrorCode.VALIDATION_FAILED, "payload");
    }

    @Test
    void serverCapsAreEnforcedOnDrafts() {
        String longBody = "가".repeat(10_001);
        assertCode(() -> normalizer.normalize(ContentType.SMS, tree("{\"body\":\"" + longBody + "\"}")),
                ErrorCode.LIMIT_EXCEEDED, "payload.body");
        assertThat(normalizer.normalize(ContentType.SMS, tree("{\"body\":\"" + "가".repeat(10_000) + "\"}"))
                .path("body").asString()).hasSize(10_000);
        // the button cap (20) is an abuse guard above the channel spec (5 buttons only warns)
        String twenty = "{\"buttons\":[" + String.join(",", java.util.Collections.nCopies(20, "{}")) + "]}";
        String twentyOne = "{\"buttons\":[" + String.join(",", java.util.Collections.nCopies(21, "{}")) + "]}";
        assertThat(normalizer.normalize(ContentType.ALIMTALK, tree(twenty)).path("buttons")).hasSize(20);
        assertThat(normalizer.normalize(ContentType.ALIMTALK, tree("{\"buttons\":[{},{},{},{},{},{}]}"))
                .path("buttons")).hasSize(6);
        assertCode(() -> normalizer.normalize(ContentType.ALIMTALK, tree(twentyOne)), ErrorCode.LIMIT_EXCEEDED,
                "payload.buttons");
        assertCode(() -> normalizer.normalize(ContentType.RCS, tree("{\"cards\":[{},{},{},{},{},{}]}")),
                ErrorCode.LIMIT_EXCEEDED, "payload.cards");
        assertThat(normalizer.normalize(ContentType.RCS, tree("{\"cards\":[]}")).path("cards")).isEmpty();
    }

    private static void assertCode(Runnable r, ErrorCode code, String field) {
        assertThatThrownBy(r::run).isInstanceOfSatisfying(BusinessException.class, e -> {
            assertThat(e.getCode()).isEqualTo(code);
            assertThat(e.getFieldErrors()).extracting(f -> f.field()).containsExactly(field);
        });
    }
}
