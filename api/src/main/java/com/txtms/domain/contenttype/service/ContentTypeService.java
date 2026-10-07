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
import com.txtms.global.exception.BusinessException;

@Service
@Transactional(readOnly = true)
public class ContentTypeService {

    private final ContentTypeSettingRepository settings;
    private final WritingGuideRepository guides;

    public ContentTypeService(ContentTypeSettingRepository settings, WritingGuideRepository guides) {
        this.settings = settings;
        this.guides = guides;
    }

    public List<ContentTypeResponse> contentTypes() {
        return settings.findAllByOrderBySortOrderAsc().stream()
                .map(s -> new ContentTypeResponse(s.getType(), s.isActive(), s.isMockEnabled()))
                .toList();
    }

    public boolean isActive(ContentType type) {
        return type != null && settings.findById(type).map(s -> s.isActive()).orElse(false);
    }

    /** First active type in display order (default type of a new request). */
    public java.util.Optional<ContentType> firstActive() {
        return settings.findAllByOrderBySortOrderAsc().stream().filter(s -> s.isActive()).map(s -> s.getType())
                .findFirst();
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
        WritingGuide g = guides.findById(type).orElseThrow(BusinessException::notFound);
        return new GuideResponse(g.getType(), g.getPrinciples(), g.getGoodExpressions(), g.getChecklist());
    }
}
