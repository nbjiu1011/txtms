package com.txtms.domain.contenttype.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.contenttype.dto.ContentTypeResponse;
import com.txtms.domain.contenttype.dto.GuideResponse;
import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;

@RestController
@RequestMapping("/api")
public class ContentTypeController {

    private final ContentTypeService service;

    public ContentTypeController(ContentTypeService service) {
        this.service = service;
    }

    @GetMapping("/content-types")
    public List<ContentTypeResponse> contentTypes() {
        return service.contentTypes();
    }

    @GetMapping("/guides/{type}")
    public GuideResponse guide(@PathVariable ContentType type) {
        return service.guide(type);
    }
}
