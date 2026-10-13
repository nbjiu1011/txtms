package com.txtms.domain.request.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;

import tools.jackson.databind.json.JsonMapper;

class BulkRowValidatorTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final BulkRowValidator validator = new BulkRowValidator(new ChannelSpecCheck(
            new ChannelSpecCheck.Spec(1000, 5, 14, 90, 2000), "고객센터 1588-0000", "무료 수신거부 080-000-0000"));

    private java.util.List<String> alimtalk(String payload) {
        return validator.validate(ContentType.ALIMTALK, json.readTree(payload), Set.of("HB_POINT_01"),
                Map.of("customer_name", "홍길동"));
    }

    private java.util.List<String> sms(String payload) {
        return validator.validate(ContentType.SMS, json.readTree(payload), Set.of(),
                Map.of("customer_name", "홍길동"));
    }

    @Test
    void validRows() {
        assertThat(alimtalk("{\"templateCode\":\"HB_POINT_01\",\"body\":\"#{customer_name}님\",\"buttons\":"
                + "[{\"name\":\"보기\",\"link\":\"http://a.kr\"}]}")).isEmpty();
        assertThat(sms("{\"sender\":\"1588-0000\",\"body\":\"안내\",\"customerCenter\":false,\"optOut\":true}"))
                .isEmpty();
    }

    @Test
    void alimtalkRowErrors() {
        assertThat(alimtalk("{\"templateCode\":\"X\",\"body\":\"\",\"buttons\":[{\"name\":\"보기\",\"link\":\"\"}]}"))
                .containsExactly("승인 템플릿 없음", "본문 없음", "버튼명과 링크를 함께 입력");
        // spec overruns are warnings, not errors
        String over = "{\"templateCode\":\"HB_POINT_01\",\"body\":\"" + "가".repeat(1001) + "\",\"buttons\":"
                + "[{\"name\":\"" + "버".repeat(15) + "\",\"link\":\"ftp://a.kr\"}]}";
        assertThat(alimtalk(over)).containsExactly("링크는 http 또는 https");
        assertThat(validator.warnings(ContentType.ALIMTALK, json.readTree(over)))
                .containsExactly("본문 1,000자 초과 (1,001자)", "버튼명 14자 초과 (" + "버".repeat(15) + ")");
        assertThat(alimtalk("{\"templateCode\":\"HB_POINT_01\",\"body\":\"#{nope}\",\"buttons\":[]}"))
                .containsExactly("미등록 변수 nope");
    }

    @Test
    void smsRowErrorsUseTheSingleByteRule() {
        assertThat(sms("{\"sender\":\"02\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}"))
                .containsExactly("본문 없음");
        // the 발신자 column is optional free text: blank or any value is never an error
        assertThat(sms("{\"sender\":\"\",\"body\":\"안내\",\"customerCenter\":false,\"optOut\":false}")).isEmpty();
        assertThat(sms("{\"sender\":\"마케팅팀\",\"body\":\"안내\",\"customerCenter\":false,\"optOut\":false}"))
                .isEmpty();
        // 1,973 + 27 = 2,000 (LMS); 1,974 + 27 = 2,001 over LMS: a warning, never an error
        String lms = "{\"sender\":\"1588-0000\",\"body\":\"" + "a".repeat(1973) + "\",\"customerCenter\":false,"
                + "\"optOut\":true}";
        String over = "{\"sender\":\"1588-0000\",\"body\":\"" + "a".repeat(1974) + "\",\"customerCenter\":false,"
                + "\"optOut\":true}";
        assertThat(sms(lms)).isEmpty();
        assertThat(sms(over)).isEmpty();
        assertThat(validator.warnings(ContentType.SMS, json.readTree(lms)))
                .containsExactly("SMS 90바이트 초과 — LMS 예상 전환 (2,000바이트)");
        assertThat(validator.warnings(ContentType.SMS, json.readTree(over)))
                .containsExactly("LMS 2,000바이트 초과 (2,001바이트)");
    }
}
