package com.txtms.domain.request.validation;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestInfo;
import com.txtms.global.exception.ErrorResponse;

import tools.jackson.databind.JsonNode;

/**
 * Submit validation (also used at review completion later). Produces the missing-item list in the order and wording
 * of the screen: common request fields and required content fields first ({@code "{key} {title}: item"}), then the
 * registration, link, variable and attachment rules ({@code "{key}: item"}). Duplicates are dropped and a rule is not
 * repeated for the same cause (an empty template is reported once as missing, not also as unregistered). Channel
 * specification overruns (Alimtalk length/buttons, SMS/LMS bytes, EUC-KR characters) are only {@code warnings}
 * ({@code "{key} {title}: item"}) and never fail the validation. Text correction results are never required.
 */
public final class SubmitValidator {

    public static final String SUMMARY = "검수를 요청하려면 다음 항목을 채우세요";

    /** Attachment limits used by the rules. */
    public record Limits(int filesMax, long filesTotalBytesMax) {
    }

    public record Input(
            RequestInfo info,
            ContentType type,
            boolean typeActive,
            boolean projectActive,
            Set<String> templateCodes,
            Set<String> senders,
            /** Active, not deleted variables of the project: key → current value. */
            Map<String, String> variables,
            List<ContentInput> contents) {
    }

    public record ContentInput(String key, String title, JsonNode payload, List<FileInput> files) {
    }

    public record FileInput(String name, Integer totalAmount, Integer reviewAmount, long sizeBytes, boolean scanSafe) {
    }

    /** {@code warnings}: channel specification notes, independent of {@link #ok()}. */
    public record Result(List<String> details, List<ErrorResponse.FieldErrorItem> fieldErrors,
            List<String> warnings) {
        public boolean ok() {
            return details.isEmpty();
        }
    }

    private final Limits limits;
    private final ChannelSpecCheck channelSpec;

    public SubmitValidator(Limits limits, ChannelSpecCheck channelSpec) {
        this.limits = limits;
        this.channelSpec = channelSpec;
    }

    public Result validate(Input in) {
        Set<String> list = new LinkedHashSet<>();
        List<ErrorResponse.FieldErrorItem> fields = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // --- common request information
        RequestInfo info = in.info();
        requireText(info.title(), "title", "제목", list, fields);
        requireText(info.hopeDueDate() == null ? null : info.hopeDueDate().toString(), "hopeDueDate", "희망 납기",
                list, fields);
        requireText(info.purpose(), "purpose", "목적", list, fields);
        requireText(info.target(), "target", "대상 고객", list, fields);
        requireText(info.background(), "background", "배경", list, fields);
        if (!in.typeActive()) {
            fields.add(new ErrorResponse.FieldErrorItem("type", "사용 중인 유형만 선택할 수 있습니다"));
            list.add("요청 정보: 유형");
        }
        if (in.contents().isEmpty()) {
            list.add("콘텐츠가 1건 이상 필요합니다");
        }

        // --- required content fields
        for (ContentInput c : in.contents()) {
            String p = c.key() + " " + c.title();
            JsonNode f = c.payload();
            switch (in.type()) {
                case ALIMTALK -> {
                    if (blank(f, "templateCode")) {
                        list.add(p + ": 승인 템플릿");
                    }
                    if (blank(f, "body")) {
                        list.add(p + ": 본문");
                    }
                    int i = 0;
                    for (JsonNode b : f.path("buttons")) {
                        i++;
                        if (blank(b, "name") || blank(b, "link")) {
                            list.add(p + ": 버튼 " + i + " 이름과 링크");
                        }
                    }
                }
                case SMS -> {
                    if (blank(f, "sender")) {
                        list.add(p + ": 발신번호");
                    }
                    if (blank(f, "body")) {
                        list.add(p + ": 본문");
                    }
                }
                case RCS -> {
                    int i = 0;
                    for (JsonNode card : f.path("cards")) {
                        i++;
                        if (blank(card, "body")) {
                            list.add(p + ": 카드 " + i + " 본문");
                        }
                        if (!blank(card, "imageKey") && blank(card, "imageAlt")) {
                            list.add(p + ": 카드 " + i + " 이미지 설명");
                        }
                    }
                }
                case FREEFORM -> {
                    if (blank(f, "text") && c.files().isEmpty()) {
                        list.add(p + ": 텍스트 또는 첨부파일");
                    }
                    for (FileInput file : c.files()) {
                        if (!positive(file.totalAmount()) || !positive(file.reviewAmount())) {
                            list.add(p + ": " + file.name() + " 전체 분량과 실제 검수 범위");
                        }
                    }
                }
            }
        }

        // --- registration, links, variables, attachments
        if (!in.projectActive()) {
            list.add("사용 중인 프로젝트에서 검수를 요청하세요");
        }
        int fileCount = 0;
        long fileBytes = 0;
        boolean scanPending = false;
        for (ContentInput c : in.contents()) {
            String label = c.key();
            JsonNode f = c.payload();
            switch (in.type()) {
                case ALIMTALK -> {
                    if (!blank(f, "templateCode") && !in.templateCodes().contains(str(f, "templateCode"))) {
                        list.add(label + ": 등록된 승인 템플릿");
                    }
                    for (JsonNode b : f.path("buttons")) {
                        if (!blank(b, "link") && !Links.valid(str(b, "link"), in.variables())) {
                            list.add(label + ": HTTP/HTTPS 버튼 링크");
                        }
                    }
                }
                case SMS -> {
                    if (!blank(f, "sender") && !in.senders().contains(str(f, "sender"))) {
                        list.add(label + ": 등록된 발신번호");
                    }
                }
                case RCS -> {
                    if (f.path("cards").isEmpty()) {
                        list.add(label + ": 카드 1개 이상");
                    }
                    int i = 0;
                    for (JsonNode card : f.path("cards")) {
                        i++;
                        if (blank(card, "title")) {
                            list.add(label + ": 카드 " + i + " 제목");
                        }
                        boolean hasName = !blank(card, "buttonName");
                        boolean hasLink = !blank(card, "buttonLink");
                        if (hasName != hasLink || hasLink && !Links.valid(str(card, "buttonLink"), in.variables())) {
                            list.add(label + ": 카드 " + i + " 버튼명과 HTTP/HTTPS 링크");
                        }
                    }
                }
                case FREEFORM -> {
                    // text is free; files are checked below for every type
                }
            }
            for (String warning : channelSpec.warnings(in.type(), f)) {
                warnings.add(c.key() + " " + c.title() + ": " + warning);
            }
            for (String key : variableKeys(f)) {
                if (!in.variables().containsKey(key)) {
                    list.add(label + ": 등록되지 않았거나 비활성 변수 " + key);
                }
            }
            for (FileInput file : c.files()) {
                fileCount++;
                fileBytes += file.sizeBytes();
                if (!file.scanSafe()) {
                    scanPending = true;
                }
                // missing amounts are reported above as "전체 분량과 실제 검수 범위"
                if (positive(file.totalAmount()) && positive(file.reviewAmount())
                        && file.reviewAmount() > file.totalAmount()) {
                    list.add(label + ": " + file.name() + " 검수 범위는 전체 분량 이내의 양의 정수");
                }
            }
        }
        if (fileCount > limits.filesMax() || fileBytes > limits.filesTotalBytesMax()) {
            list.add("요청당 첨부 최대 " + limits.filesMax() + "개, 총 "
                    + limits.filesTotalBytesMax() / (1024 * 1024) + "MB");
        }
        if (scanPending) {
            list.add("첨부파일 업로드·검사가 끝난 후 요청하세요");
        }
        return new Result(List.copyOf(list), List.copyOf(fields), List.copyOf(warnings));
    }

    /** Variable keys used anywhere in the payload's text values, in order. */
    public static Set<String> variableKeys(JsonNode payload) {
        Set<String> keys = new LinkedHashSet<>();
        collect(payload, keys);
        return keys;
    }

    private static void collect(JsonNode node, Set<String> keys) {
        if (node == null) {
            return;
        }
        if (node.isString()) {
            keys.addAll(VariableTokens.keys(node.asString()));
        } else if (node.isContainer()) {
            node.forEach(child -> collect(child, keys));
        }
    }

    private static void requireText(String value, String field, String label, Set<String> list,
            List<ErrorResponse.FieldErrorItem> fields) {
        if (value == null || value.isBlank()) {
            fields.add(new ErrorResponse.FieldErrorItem(field, label + "을(를) 입력하세요"));
            list.add("요청 정보: " + label);
        }
    }

    private static boolean positive(Integer n) {
        return n != null && n > 0;
    }

    private static String str(JsonNode node, String key) {
        JsonNode v = node.get(key);
        return v == null || v.isNull() ? "" : v.asString("");
    }

    private static boolean blank(JsonNode node, String key) {
        return str(node, key).isBlank();
    }
}
