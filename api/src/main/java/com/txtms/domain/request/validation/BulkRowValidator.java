package com.txtms.domain.request.validation;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.txtms.domain.contenttype.entity.ContentType;

import tools.jackson.databind.JsonNode;

/**
 * Row rules of the XLSX bulk registration (Alimtalk and SMS), applied to the payload a row maps to. One row's errors
 * never fail the whole file. Links follow the same http/https rule as submit. Channel specification overruns are
 * {@link #warnings warnings} (the same rule as submit) and never make a row invalid.
 */
public final class BulkRowValidator {

    /** Header row of the templates (compared with whitespace removed). */
    public static final List<String> ALIMTALK_HEADER = List.of("승인템플릿", "본문", "버튼명", "버튼링크");
    public static final List<String> SMS_HEADER = List.of("발신자", "본문", "수신거부문구포함");

    private final ChannelSpecCheck channelSpec;

    public BulkRowValidator(ChannelSpecCheck channelSpec) {
        this.channelSpec = channelSpec;
    }

    public static List<String> header(ContentType type) {
        return type == ContentType.ALIMTALK ? ALIMTALK_HEADER : SMS_HEADER;
    }

    public List<String> validate(ContentType type, JsonNode payload, Set<String> templateCodes,
            Map<String, String> variables) {
        List<String> errors = new ArrayList<>();
        if (type == ContentType.ALIMTALK) {
            String template = str(payload, "templateCode");
            String body = str(payload, "body");
            if (!templateCodes.contains(template)) {
                errors.add("승인 템플릿 없음");
            }
            if (body.isBlank()) {
                errors.add("본문 없음");
            }
            for (JsonNode b : payload.path("buttons")) {
                String name = str(b, "name");
                String link = str(b, "link");
                if (name.isBlank() != link.isBlank()) {
                    errors.add("버튼명과 링크를 함께 입력");
                }
                if (!link.isBlank() && !Links.valid(link, variables)) {
                    errors.add("링크는 http 또는 https");
                }
            }
        } else if (type == ContentType.SMS) {
            // the 발신자 column is optional free text (no registered sender numbers)
            String body = str(payload, "body");
            if (body.isBlank()) {
                errors.add("본문 없음");
            }
        }
        Set<String> missing = new LinkedHashSet<>();
        for (String key : SubmitValidator.variableKeys(payload)) {
            if (!variables.containsKey(key)) {
                missing.add("미등록 변수 " + key);
            }
        }
        errors.addAll(missing);
        return errors;
    }

    /** Channel specification warnings of a row (never errors). */
    public List<String> warnings(ContentType type, JsonNode payload) {
        return channelSpec.warnings(type, payload);
    }

    private static String str(JsonNode node, String key) {
        JsonNode v = node.get(key);
        return v == null || v.isNull() ? "" : v.asString("");
    }
}
