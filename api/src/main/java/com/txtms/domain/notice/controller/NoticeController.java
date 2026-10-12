package com.txtms.domain.notice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.notice.dto.NoticeBody;
import com.txtms.domain.notice.dto.NoticeResponse;
import com.txtms.domain.notice.service.NoticeService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api")
public class NoticeController {

    private final NoticeService notices;

    public NoticeController(NoticeService notices) {
        this.notices = notices;
    }

    /** Notices visible to the caller within the customer (withdrawn excluded), newest first. */
    @GetMapping("/notices")
    public PageResponse<NoticeResponse> list(@AuthenticationPrincipal AuthUser auth, @RequestParam long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return notices.list(auth, customerId, PageQuery.of(page, size));
    }

    /** Customer admin: every notice of the customer, withdrawn ones included. */
    @GetMapping("/customers/{customerId}/notices/manage")
    public PageResponse<NoticeResponse> manage(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return notices.manage(auth, customerId, PageQuery.of(page, size));
    }

    @PostMapping("/customers/{customerId}/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse create(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestBody(required = false) NoticeBody body) {
        return notices.create(auth, customerId, body);
    }

    @PatchMapping("/notices/{noticeId}")
    public NoticeResponse update(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId,
            @RequestBody(required = false) NoticeBody body) {
        return notices.update(auth, noticeId, body);
    }

    @PostMapping("/notices/{noticeId}/withdraw")
    public NoticeResponse withdraw(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        return notices.withdraw(auth, noticeId);
    }
}
