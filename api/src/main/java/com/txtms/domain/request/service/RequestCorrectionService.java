package com.txtms.domain.request.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.correction.engine.CorrectionEngine;
import com.txtms.domain.correction.engine.CorrectionFields;
import com.txtms.domain.correction.engine.Finding;
import com.txtms.domain.correction.service.CorrectionSuggestionService;
import com.txtms.domain.correction.service.DatasetService;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.request.CorrectionBodies.CheckBody;
import com.txtms.domain.request.dto.request.CorrectionBodies.CheckItem;
import com.txtms.domain.request.dto.request.CorrectionBodies.EventBody;
import com.txtms.domain.request.dto.request.CorrectionBodies.SuggestionBody;
import com.txtms.domain.request.dto.response.CorrectionResponses.CheckResponse;
import com.txtms.domain.request.dto.response.CorrectionResponses.CorrectionResult;
import com.txtms.domain.request.dto.response.CorrectionResponses.DatasetInfo;
import com.txtms.domain.request.dto.response.CorrectionResponses.Group;
import com.txtms.domain.request.dto.response.CorrectionResponses.Option;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.request.validation.PayloadNormalizer;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.node.ObjectNode;

/**
 * Text correction of a request (contract §6): check the editing buffer with the customer × type dataset, record
 * apply/restore events in the history, and store suggestions. Results are not stored (tab state only); applying a
 * correction is an edit of the client's buffer (draft autosave or revision buffer).
 * <p>
 * Check: anyone who may view the request (read-only, nothing stored — prototype behaviour). Suggestions: whoever
 * may edit or review the request now ({@code EDIT_CONTENT} or {@code REVIEW}); events: {@code EDIT_CONTENT}.
 * Visible requests without those actions are {@code REQUEST_STATE_CONFLICT}; operators and other customers
 * {@code NOT_FOUND} (request visibility).
 */
@Service
@Transactional
public class RequestCorrectionService {

    static final int SPAN_TEXT_MAX = 1000;
    static final int RULE_IDS_MAX = 50;
    static final int RULE_ID_MAX = 50;
    static final int SUGGESTED_EXPR_MAX = 200;

    private final RequestQueryService queries;
    private final RequestWriteSupport support;
    private final UserService userService;
    private final ProjectAccess projectAccess;
    private final PayloadNormalizer normalizer;
    private final DatasetService datasets;
    private final CorrectionSuggestionService suggestions;
    private final Clock clock;
    private final AppProperties.Content limits;
    private final Duration lockTtl;

    public RequestCorrectionService(RequestQueryService queries, RequestWriteSupport support,
            UserService userService, ProjectAccess projectAccess, PayloadNormalizer normalizer,
            DatasetService datasets, CorrectionSuggestionService suggestions, Clock clock, AppProperties properties) {
        this.queries = queries;
        this.support = support;
        this.userService = userService;
        this.projectAccess = projectAccess;
        this.normalizer = normalizer;
        this.datasets = datasets;
        this.suggestions = suggestions;
        this.clock = clock;
        this.limits = properties.content();
        this.lockTtl = properties.lock().ttl();
    }

    // ------------------------------------------------------------------ check

    /**
     * Checks the given contents (their editing buffers) with the effective dataset of the request's customer and
     * type. Only the entered text is checked (a free-form content's attachments are not read). Nothing is stored.
     */
    @Transactional(readOnly = true)
    public CheckResponse check(AuthUser auth, String id, CheckBody body) {
        Actor actor = userService.actorOf(userService.require(auth.userId()));
        ScopedRequest s = queries.requireVisible(actor, id);
        List<CheckItem> items = body == null ? null : body.contents();
        if (items == null || items.isEmpty()) {
            throw BusinessException.validation("contents", "검사할 콘텐츠를 선택하세요");
        }
        if (items.size() > limits.maxContentsPerRequest()) {
            throw new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                    String.format("한 번에 최대 %,d건까지 검사할 수 있습니다", limits.maxContentsPerRequest()));
        }
        ContentType type = s.request().getType();
        DatasetService.EffectiveDataset dataset = datasets.effective(s.project().customerId(), type)
                .orElseThrow(() -> new BusinessException(ErrorCode.DATASET_NOT_ASSIGNED));

        Map<String, Content> current = new LinkedHashMap<>();
        support.currentContents(id).forEach(c -> current.put(c.getKey(), c));
        List<Content> targets = new ArrayList<>();
        List<ObjectNode> payloads = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < items.size(); i++) {
            CheckItem item = items.get(i);
            String prefix = "contents." + i + ".";
            String key = item == null || item.contentKey() == null ? "" : item.contentKey().trim();
            if (key.isEmpty()) {
                throw BusinessException.validation(prefix + "contentKey", "콘텐츠를 선택하세요");
            }
            if (!seen.add(key)) {
                throw BusinessException.validation(prefix + "contentKey", "같은 콘텐츠를 두 번 보냈습니다");
            }
            Content c = current.get(key);
            if (c == null) {
                throw BusinessException.notFound();
            }
            targets.add(c);
            payloads.add(normalized(type, item, prefix));
        }

        int variablesRevision = projectAccess.requireProject(s.project().projectId()).getVariablesRevision();
        Instant now = clock.instant();
        List<CorrectionResult> results = new ArrayList<>(targets.size());
        for (int i = 0; i < targets.size(); i++) {
            Content c = targets.get(i);
            results.add(new CorrectionResult(c.getKey(), now, dataset.label(), variablesRevision,
                    groups(dataset.engine(), type, payloads.get(i))));
        }
        return new CheckResponse(results);
    }

    static List<Group> groups(CorrectionEngine engine, ContentType type, ObjectNode payload) {
        List<Group> groups = new ArrayList<>();
        for (CorrectionFields.Field field : CorrectionFields.of(type, payload)) {
            for (Finding f : engine.run(field.text())) {
                groups.add(new Group(field.key() + ":" + f.start() + ":" + f.end(), field.key(), f.start(), f.end(),
                        f.matchedText(), f.options().stream()
                                .map(o -> new Option(o.ruleId(), o.recommended(), o.descriptionLabel(),
                                        o.description()))
                                .toList()));
            }
        }
        return groups;
    }

    /** Strict payload shape of the buffer; field errors are prefixed with {@code contents.{i}.}. */
    private ObjectNode normalized(ContentType type, CheckItem item, String prefix) {
        try {
            return normalizer.normalize(type, item.payload());
        } catch (BusinessException e) {
            List<ErrorResponse.FieldErrorItem> fields = e.getFieldErrors() == null ? null
                    : e.getFieldErrors().stream()
                            .map(f -> new ErrorResponse.FieldErrorItem(prefix + f.field(), f.message())).toList();
            throw new BusinessException(e.getCode(), e.getMessage(), fields, e.getDetails());
        }
    }

    /** Label of the effective dataset for the panel header (any viewer of the request). */
    @Transactional(readOnly = true)
    public DatasetInfo dataset(AuthUser auth, String id) {
        Actor actor = userService.actorOf(userService.require(auth.userId()));
        ScopedRequest s = queries.requireVisible(actor, id);
        String label = datasets.effectiveLabel(s.project().customerId(), s.request().getType()).orElse(null);
        return new DatasetInfo(label != null, label);
    }

    // ------------------------------------------------------------------ apply / restore history

    /** History {@code 교정 적용} / {@code 교정 복원} with detail {@code {field}: {before} → {after}}. */
    public void event(AuthUser auth, String id, EventBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        if (body == null) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED);
        }
        Content c = content(ctx, body.contentKey());
        String action = switch (body.action() == null ? "" : body.action()) {
            case "APPLY" -> "교정 적용";
            case "RESTORE" -> "교정 복원";
            default -> throw BusinessException.validation("action", "action은 APPLY 또는 RESTORE입니다");
        };
        ContentType type = ctx.request().getType();
        if (!CorrectionFields.validKey(type, body.field())) {
            throw BusinessException.validation("field", "교정 위치를 확인하세요");
        }
        String before = spanText(body.before(), "before");
        String after = spanText(body.after(), "after");
        String ruleId = optionalRuleId(body.ruleId());
        requireNotLockedByOther(ctx, c);
        support.log(ctx.request(), ctx.userId(), action,
                body.field() + ": " + before + " → " + after + (ruleId == null ? "" : " (" + ruleId + ")"), c);
    }

    /** Optional rule id of an apply/restore event (contract §14.4): trimmed, at most 50 characters. */
    static String optionalRuleId(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) {
            return null;
        }
        if (v.length() > RULE_ID_MAX) {
            throw BusinessException.validation("ruleId", "규칙 ID는 최대 50자입니다");
        }
        return v;
    }

    /** Optional proposed expression of a suggestion (contract §14.4): at most 200 characters, blank = none. */
    static String optionalSuggestedExpr(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        if (raw.length() > SUGGESTED_EXPR_MAX) {
            throw BusinessException.validation("suggestedExpr", "제안 표현은 최대 200자입니다");
        }
        return raw;
    }

    // ------------------------------------------------------------------ suggestions

    /** "건의하기": stored for Phase 2 processing, history {@code 교정 건의} detail {@code {key}: {이유}}. */
    public void suggest(AuthUser auth, String id, SuggestionBody body) {
        Ctx ctx = support.lock(auth, id);
        if (!support.allows(ctx, RequestAction.EDIT_CONTENT) && !support.allows(ctx, RequestAction.REVIEW)) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
        if (body == null) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED);
        }
        Content c = content(ctx, body.contentKey());
        if (body.matchedText() == null || body.matchedText().isBlank()) {
            throw BusinessException.validation("matchedText", "건의할 교정 결과를 선택하세요");
        }
        if (body.matchedText().length() > SPAN_TEXT_MAX) {
            throw BusinessException.validation("matchedText", "교정 대상 표현은 최대 1,000자입니다");
        }
        List<String> ruleIds = new ArrayList<>();
        if (body.ruleIds() != null) {
            if (body.ruleIds().size() > RULE_IDS_MAX) {
                throw BusinessException.validation("ruleIds", "규칙은 최대 " + RULE_IDS_MAX + "개입니다");
            }
            for (String r : body.ruleIds()) {
                if (r == null || r.isBlank() || r.length() > 50) {
                    throw BusinessException.validation("ruleIds", "규칙 ID를 확인하세요");
                }
                ruleIds.add(r.trim());
            }
        }
        String reason = body.body() == null ? "" : body.body().trim();
        if (reason.isEmpty()) {
            throw BusinessException.validation("body", "건의 이유을(를) 입력하세요");
        }
        if (reason.length() > limits.maxInfoTextLength()) {
            throw BusinessException.validation("body",
                    String.format("건의 이유은(는) 최대 %,d자입니다", limits.maxInfoTextLength()));
        }
        String suggestedExpr = optionalSuggestedExpr(body.suggestedExpr());
        suggestions.record(ctx.request().getId(), c.getKey(), body.matchedText(), suggestedExpr, ruleIds, reason,
                ctx.userId(), support.now());
        support.log(ctx.request(), ctx.userId(), "교정 건의", c.getKey() + ": " + reason, c);
    }

    // ------------------------------------------------------------------ helpers

    private Content content(Ctx ctx, String key) {
        if (key == null || key.isBlank()) {
            throw BusinessException.validation("contentKey", "콘텐츠를 선택하세요");
        }
        return support.content(ctx, key.trim());
    }

    private static String spanText(String value, String field) {
        if (value == null || value.isEmpty()) {
            throw BusinessException.validation(field, "교정 전후 표현을 입력하세요");
        }
        if (value.length() > SPAN_TEXT_MAX) {
            throw BusinessException.validation(field, "교정 표현은 최대 1,000자입니다");
        }
        return value;
    }

    /** An edit outside the draft needs the content not to be locked by someone else. */
    private void requireNotLockedByOther(Ctx ctx, Content c) {
        if (ctx.request().getStatus() != RequestStatus.DRAFT && c.lockedByOther(ctx.userId(), support.now(), lockTtl)) {
            throw new BusinessException(ErrorCode.LOCKED_BY_OTHER);
        }
    }
}
