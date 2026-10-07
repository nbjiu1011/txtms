package com.txtms.domain.request.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;

import tools.jackson.databind.json.JsonMapper;

class BulkRowValidatorTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final BulkRowValidator validator = new BulkRowValidator(new SubmitValidator.Limits(1000, 5, 14, 2000, 10,
            100L * 1024 * 1024, "고객센터 1588-0000", "무료 수신거부 080-000-0000"));

    private java.util.List<String> alimtalk(String payload) {
        return validator.validate(ContentType.ALIMTALK, json.readTree(payload), Set.of("HB_POINT_01"), Set.of(),
                Map.of("customer_name", "홍길동"));
    }

    private java.util.List<String> sms(String payload) {
        return validator.validate(ContentType.SMS, json.readTree(payload), Set.of(), Set.of("1588-0000"),
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
        assertThat(alimtalk("{\"templateCode\":\"HB_POINT_01\",\"body\":\"" + "가".repeat(1001) + "\",\"buttons\":"
                + "[{\"name\":\"" + "버".repeat(15) + "\",\"link\":\"ftp://a.kr\"}]}"))
                .containsExactly("링크는 http 또는 https", "본문 1,000자 / 버튼명 14자 초과");
        assertThat(alimtalk("{\"templateCode\":\"HB_POINT_01\",\"body\":\"#{nope}\",\"buttons\":[]}"))
                .containsExactly("미등록 변수 nope");
    }

    @Test
    void smsRowErrorsUseTheSingleByteRule() {
        assertThat(sms("{\"sender\":\"02\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}"))
                .containsExactly("등록되지 않은 발신번호", "본문 없음");
        // 1,973 + 27 = 2,000 ok; 1,974 + 27 = 2,001 too long
        assertThat(sms("{\"sender\":\"1588-0000\",\"body\":\"" + "a".repeat(1973) + "\",\"customerCenter\":false,"
                + "\"optOut\":true}")).isEmpty();
        assertThat(sms("{\"sender\":\"1588-0000\",\"body\":\"" + "a".repeat(1974) + "\",\"customerCenter\":false,"
                + "\"optOut\":true}")).containsExactly("LMS 2,000바이트 초과");
    }
}
