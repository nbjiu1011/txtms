package com.txtms.domain.notice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    /** Published notices visible to the caller within the customer, most recently published first. */
    @GetMapping("/notices")
    public PageResponse<NoticeResponse> list(@AuthenticationPrincipal AuthUser auth, @RequestParam long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return notices.list(auth, customerId, PageQuery.of(page, size));
    }

    /** One notice the caller may read (admins: unpublished and deleted ones too). */
    @GetMapping("/notices/{noticeId}")
    public NoticeResponse detail(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        return notices.detail(auth, noticeId);
    }

    /** Customer admin: the customer's notices, published or not (the deleted ones with {@code deleted=true}). */
    @GetMapping("/customers/{customerId}/notices/manage")
    public PageResponse<NoticeResponse> manage(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestParam(defaultValue = "false") boolean deleted, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return notices.manage(auth, customerId, deleted, PageQuery.of(page, size));
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

    @PostMapping("/notices/{noticeId}/publish")
    public NoticeResponse publish(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        return notices.publish(auth, noticeId);
    }

    @PostMapping("/notices/{noticeId}/unpublish")
    public NoticeResponse unpublish(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        return notices.unpublish(auth, noticeId);
    }

    /** Soft delete (kept for the deleted list and restoring). */
    @DeleteMapping("/notices/{noticeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        notices.delete(auth, noticeId);
    }

    @PostMapping("/notices/{noticeId}/restore")
    public NoticeResponse restore(@AuthenticationPrincipal AuthUser auth, @PathVariable long noticeId) {
        return notices.restore(auth, noticeId);
    }
}
