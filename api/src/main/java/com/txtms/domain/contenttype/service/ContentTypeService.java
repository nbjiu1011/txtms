package com.txtms.domain.contenttype.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.dto.ContentTypeResponse;
import com.txtms.domain.contenttype.dto.GuideResponse;
import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.entity.WritingGuide;
import com.txtms.domain.contenttype.repository.ContentTypeSettingRepository;
import com.txtms.domain.contenttype.repository.WritingGuideRepository;
import com.txtms.domain.contenttype.entity.ContentTypeSetting;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.exception.BusinessException;

@Service
@Transactional(readOnly = true)
public class ContentTypeService {

    private final ContentTypeSettingRepository settings;
    private final WritingGuideRepository guides;
    private final AuditLogService audit;
    private final java.time.Clock clock;

    public ContentTypeService(ContentTypeSettingRepository settings, WritingGuideRepository guides,
            AuditLogService audit, java.time.Clock clock) {
        this.settings = settings;
        this.guides = guides;
        this.audit = audit;
        this.clock = clock;
    }

    /** Phase 1 content types in display order (RCS is deferred and never listed). */
    public List<ContentTypeResponse> contentTypes() {
        return offered().stream()
                .map(s -> new ContentTypeResponse(s.getType(), s.isActive(), s.isMockEnabled()))
                .toList();
    }

    /**
     * Operator switch of a content type (contract §12). Existing requests keep their type; only new requests and
     * type changes check it. A change is audited as {@code 콘텐츠 유형 변경} ({@code 사용 → 중지}); the same value again
     * changes nothing.
     */
    @Transactional
    public ContentTypeResponse setActive(ContentType type, boolean active, long actorId) {
        if (!type.offered()) {
            throw BusinessException.notFound(); // deferred types are not managed
        }
        ContentTypeSetting s = settings.findById(type).orElseThrow(BusinessException::notFound);
        if (s.isActive() != active) {
            s.changeActive(active, actorId, clock.instant());
            audit.record(actorId, null, "콘텐츠 유형 변경", label(type),
                    (active ? "중지" : "사용") + " → " + (active ? "사용" : "중지"));
        }
        return new ContentTypeResponse(s.getType(), s.isActive(), s.isMockEnabled());
    }

    /** Content types in use (display order). */
    public java.util.List<ContentType> activeTypes() {
        return offered().stream().filter(ContentTypeSetting::isActive).map(ContentTypeSetting::getType).toList();
    }

    /** In use for new contents: offered in Phase 1 and switched on by the operator. */
    public boolean isActive(ContentType type) {
        return type != null && type.offered() && settings.findById(type).map(s -> s.isActive()).orElse(false);
    }

    /** First active type in display order (default type of a new request). */
    public java.util.Optional<ContentType> firstActive() {
        return activeTypes().stream().findFirst();
    }

    private List<ContentTypeSetting> offered() {
        return settings.findAllByOrderBySortOrderAsc().stream().filter(s -> s.getType().offered()).toList();
    }

    /** Korean label used in history details. */
    public static String label(ContentType type) {
        return switch (type) {
            case ALIMTALK -> "알림톡";
            case SMS -> "문자";
            case RCS -> "RCS";
            case FREEFORM -> "자유입력형";
        };
    }

    public GuideResponse guide(ContentType type) {
        if (!type.offered()) {
            throw BusinessException.notFound();
        }
        WritingGuide g = guides.findById(type).orElseThrow(BusinessException::notFound);
        return new GuideResponse(g.getType(), g.getPrinciples(), g.getGoodExpressions(), g.getChecklist());
    }
}
