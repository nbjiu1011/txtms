package com.txtms.domain.request.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestInfo;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.validation.SubmitValidator.ContentInput;
import com.txtms.domain.request.validation.SubmitValidator.FileInput;
import com.txtms.domain.request.validation.SubmitValidator.Input;

import tools.jackson.databind.json.JsonMapper;

class SubmitValidatorTest {

    private static final long MB = 1024 * 1024;

    private final JsonMapper json = JsonMapper.builder().build();
    private final SubmitValidator validator = new SubmitValidator(new SubmitValidator.Limits(10, 100 * MB),
            new ChannelSpecCheck(new ChannelSpecCheck.Spec(1000, 5, 14, 90, 2000), "고객센터 1588-0000",
                    "무료 수신거부 080-000-0000"));

    private static final RequestInfo FULL = new RequestInfo("제목", LocalDate.of(2026, 10, 20), "목적", "대상", "배경", null,
            Urgency.NORMAL);
    private static final Map<String, String> VARS = Map.of("customer_name", "홍길동", "event_url", "https://a.kr/e");

    private Input input(ContentType type, RequestInfo info, List<ContentInput> contents) {
        return new Input(info, type, true, true, Set.of("HB_POINT_01"), Set.of("1588-0000"), VARS, contents);
    }

    private ContentInput content(String key, String payload, FileInput... files) {
        return new ContentInput(key, "콘텐츠 " + key.substring(1), json.readTree(payload), List.of(files));
    }

    private SubmitValidator.Result result(ContentType type, String... payloads) {
        List<ContentInput> cs = new java.util.ArrayList<>();
        for (int i = 0; i < payloads.length; i++) {
            cs.add(content("C" + (i + 1), payloads[i]));
        }
        return validator.validate(input(type, FULL, cs));
    }

    private List<String> details(ContentType type, String... payloads) {
        return result(type, payloads).details();
    }

    @Test
    void completeRequestPasses() {
        assertThat(details(ContentType.ALIMTALK, "{\"templateCode\":\"HB_POINT_01\",\"body\":\"#{customer_name}님\","
                + "\"buttons\":[{\"name\":\"자세히 보기\",\"link\":\"#{event_url}\"}]}")).isEmpty();
        assertThat(details(ContentType.SMS, "{\"sender\":\"1588-0000\",\"body\":\"안내\",\"customerCenter\":true,"
                + "\"optOut\":true}")).isEmpty();
        assertThat(details(ContentType.RCS, "{\"cards\":[{\"title\":\"t\",\"body\":\"b\",\"imageKey\":null,"
                + "\"imageAlt\":\"\",\"buttonName\":\"\",\"buttonLink\":\"\"}]}")).isEmpty();
        assertThat(details(ContentType.FREEFORM, "{\"title\":\"\",\"text\":\"본문\"}")).isEmpty();
    }

    @Test
    void requestInformationAndTypeAndProjectRules() {
        RequestInfo empty = new RequestInfo(" ", null, "", null, "", null, Urgency.NORMAL);
        SubmitValidator.Result r = validator.validate(new Input(empty, ContentType.FREEFORM, false, false, Set.of(),
                Set.of(), Map.of(), List.of()));
        assertThat(r.details()).containsExactly("요청 정보: 제목", "요청 정보: 희망 납기", "요청 정보: 목적", "요청 정보: 대상 고객",
                "요청 정보: 배경", "요청 정보: 유형", "콘텐츠가 1건 이상 필요합니다", "사용 중인 프로젝트에서 검수를 요청하세요");
        assertThat(r.fieldErrors()).extracting(f -> f.field() + "=" + f.message()).containsExactly(
                "title=제목을(를) 입력하세요", "hopeDueDate=희망 납기을(를) 입력하세요", "purpose=목적을(를) 입력하세요",
                "target=대상 고객을(를) 입력하세요", "background=배경을(를) 입력하세요", "type=사용 중인 유형만 선택할 수 있습니다");
        assertThat(r.ok()).isFalse();
    }

    @Test
    void alimtalkRules() {
        assertThat(details(ContentType.ALIMTALK, "{\"templateCode\":\"\",\"body\":\" \",\"buttons\":[{\"name\":\"a\","
                + "\"link\":\"\"}]}"))
                .containsExactly("C1 콘텐츠 1: 승인 템플릿", "C1 콘텐츠 1: 본문", "C1 콘텐츠 1: 버튼 1 이름과 링크");
        // channel limits only warn: the registration and link rules still fail, the spec overruns do not
        String longBody = "가".repeat(1001);
        SubmitValidator.Result over = result(ContentType.ALIMTALK, "{\"templateCode\":\"OTHER\",\"body\":\""
                + longBody + "\",\"buttons\":[{\"name\":\"" + "버".repeat(15) + "\",\"link\":\"ftp://a.kr\"},"
                + "{\"name\":\"b\",\"link\":\"https://a.kr\"},{\"name\":\"c\",\"link\":\"https://a.kr\"},"
                + "{\"name\":\"d\",\"link\":\"https://a.kr\"},{\"name\":\"e\",\"link\":\"https://a.kr\"},"
                + "{\"name\":\"f\",\"link\":\"https://a.kr\"}]}");
        assertThat(over.details()).containsExactly("C1: 등록된 승인 템플릿", "C1: HTTP/HTTPS 버튼 링크");
        assertThat(over.warnings()).containsExactly("C1 콘텐츠 1: 본문 1,000자 초과 (1,001자)",
                "C1 콘텐츠 1: 버튼 5개 초과 (6개)", "C1 콘텐츠 1: 버튼명 14자 초과 (" + "버".repeat(15) + ")");
        // only warnings: still ok
        SubmitValidator.Result warnedOnly = result(ContentType.ALIMTALK, "{\"templateCode\":\"HB_POINT_01\","
                + "\"body\":\"" + longBody + "\",\"buttons\":[]}");
        assertThat(warnedOnly.ok()).isTrue();
        assertThat(warnedOnly.warnings()).containsExactly("C1 콘텐츠 1: 본문 1,000자 초과 (1,001자)");
        // exactly at the limits
        SubmitValidator.Result atLimit = result(ContentType.ALIMTALK, "{\"templateCode\":\"HB_POINT_01\",\"body\":\""
                + "가".repeat(1000) + "\",\"buttons\":[{\"name\":\"" + "버".repeat(14)
                + "\",\"link\":\"http://a.kr\"}]}");
        assertThat(atLimit.details()).isEmpty();
        assertThat(atLimit.warnings()).isEmpty();
    }

    @Test
    void smsRulesUseTheSingleByteFormula() {
        assertThat(details(ContentType.SMS, "{\"sender\":\"\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}"))
                .containsExactly("C1 콘텐츠 1: 발신번호", "C1 콘텐츠 1: 본문");
        assertThat(details(ContentType.SMS, "{\"sender\":\"02-000\",\"body\":\"a\",\"customerCenter\":false,"
                + "\"optOut\":false}")).containsExactly("C1: 등록된 발신번호");
        // 1,973 bytes + 27 (opt-out line) = 2,000 → LMS; + 19 (customer center) = 2,019 → over LMS, still ok
        String body = "a".repeat(1973);
        SubmitValidator.Result lms = result(ContentType.SMS, "{\"sender\":\"1588-0000\",\"body\":\"" + body
                + "\",\"customerCenter\":false,\"optOut\":true}");
        assertThat(lms.details()).isEmpty();
        assertThat(lms.warnings()).containsExactly("C1 콘텐츠 1: SMS 90바이트 초과 — LMS 예상 전환 (2,000바이트)");
        SubmitValidator.Result over = result(ContentType.SMS, "{\"sender\":\"1588-0000\",\"body\":\"" + body
                + "\",\"customerCenter\":true,\"optOut\":true}");
        assertThat(over.ok()).isTrue();
        assertThat(over.warnings()).containsExactly("C1 콘텐츠 1: LMS 2,000바이트 초과 (2,019바이트)");
        // 90 bytes is a short SMS, characters EUC-KR cannot represent are listed once each
        SubmitValidator.Result sms = result(ContentType.SMS, "{\"sender\":\"1588-0000\",\"body\":\""
                + "a".repeat(84) + "똠😀똠\",\"customerCenter\":false,\"optOut\":false}");
        assertThat(sms.ok()).isTrue();
        assertThat(sms.warnings()).containsExactly("C1 콘텐츠 1: EUC-KR로 표현할 수 없는 문자: 똠, 😀");
    }

    @Test
    void rcsRules() {
        assertThat(details(ContentType.RCS, "{\"cards\":[]}")).containsExactly("C1: 카드 1개 이상");
        assertThat(details(ContentType.RCS, "{\"cards\":[{\"title\":\" \",\"body\":\"\",\"imageKey\":\"img_1\","
                + "\"imageAlt\":\"\",\"buttonName\":\"보기\",\"buttonLink\":\"\"},"
                + "{\"title\":\"t\",\"body\":\"b\",\"imageKey\":null,\"imageAlt\":\"\",\"buttonName\":\"보기\","
                + "\"buttonLink\":\"mailto:a@b.c\"}]}"))
                .containsExactly("C1 콘텐츠 1: 카드 1 본문", "C1 콘텐츠 1: 카드 1 이미지 설명", "C1: 카드 1 제목",
                        "C1: 카드 1 버튼명과 HTTP/HTTPS 링크", "C1: 카드 2 버튼명과 HTTP/HTTPS 링크");
    }

    @Test
    void variablesMustBeActiveProjectVariables() {
        assertThat(details(ContentType.FREEFORM, "{\"title\":\"#{customer_name}\",\"text\":\"#{old_key} #{points}"
                + " #{old_key}\"}")).containsExactly("C1: 등록되지 않았거나 비활성 변수 old_key",
                        "C1: 등록되지 않았거나 비활성 변수 points");
    }

    @Test
    void freeformWithAttachmentsStillChecksCommonFieldsAndFiles() {
        FileInput missingAmounts = new FileInput("약관.pdf", null, null, MB, true);
        FileInput overRange = new FileInput("표.xlsx", 3, 4, MB, true);
        FileInput ok = new FileInput("ok.pdf", 10, 10, MB, true);
        RequestInfo noTitle = new RequestInfo("", FULL.hopeDueDate(), "목적", "대상", "배경", null, Urgency.NORMAL);
        SubmitValidator.Result r = validator.validate(input(ContentType.FREEFORM, noTitle,
                List.of(content("C1", "{\"title\":\"\",\"text\":\"\"}", missingAmounts, overRange, ok))));
        assertThat(r.details()).containsExactly("요청 정보: 제목", "C1 콘텐츠 1: 약관.pdf 전체 분량과 실제 검수 범위",
                "C1: 표.xlsx 검수 범위는 전체 분량 이내의 양의 정수");
        // no text and no file
        assertThat(details(ContentType.FREEFORM, "{\"title\":\"\",\"text\":\" \"}"))
                .containsExactly("C1 콘텐츠 1: 텍스트 또는 첨부파일");
    }

    @Test
    void attachmentTotalsAndScanState() {
        FileInput big = new FileInput("a.pdf", 1, 1, 60 * MB, true);
        FileInput pending = new FileInput("b.pdf", 1, 1, 50 * MB, false);
        SubmitValidator.Result r = validator.validate(input(ContentType.FREEFORM, FULL,
                List.of(content("C1", "{\"title\":\"\",\"text\":\"\"}", big, pending))));
        assertThat(r.details()).containsExactly("요청당 첨부 최대 10개, 총 100MB", "첨부파일 업로드·검사가 끝난 후 요청하세요");

        FileInput[] eleven = new FileInput[11];
        for (int i = 0; i < 11; i++) {
            eleven[i] = new FileInput("f" + i + ".txt", 1, 1, 10, true);
        }
        assertThat(validator.validate(input(ContentType.FREEFORM, FULL,
                List.of(content("C1", "{\"title\":\"\",\"text\":\"\"}", eleven)))).details())
                .containsExactly("요청당 첨부 최대 10개, 총 100MB");
    }

    @Test
    void severalContentsKeepScreenOrder() {
        assertThat(details(ContentType.SMS,
                "{\"sender\":\"1588-0000\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}",
                "{\"sender\":\"999\",\"body\":\"\",\"customerCenter\":false,\"optOut\":false}"))
                .containsExactly("C1 콘텐츠 1: 본문", "C2 콘텐츠 2: 본문", "C2: 등록된 발신번호");
    }
}
