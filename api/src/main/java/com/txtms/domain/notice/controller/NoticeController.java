package com.txtms.domain.notice.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.notice.dto.NoticeResponse;
import com.txtms.domain.notice.service.NoticeService;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

    private final NoticeService notices;

    public NoticeController(NoticeService notices) {
        this.notices = notices;
    }

    @GetMapping
    public List<NoticeResponse> list(@AuthenticationPrincipal AuthUser auth, @RequestParam long customerId) {
        return notices.list(auth, customerId);
    }
}
