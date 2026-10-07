package com.txtms.domain.request.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.request.dto.request.AnswerBody;
import com.txtms.domain.request.dto.request.AskBody;
import com.txtms.domain.request.dto.request.AssignmentBody;
import com.txtms.domain.request.dto.request.AssignmentChangeBody;
import com.txtms.domain.request.dto.request.OpinionBody;
import com.txtms.domain.request.dto.request.RecallBody;
import com.txtms.domain.request.dto.request.RecallDecisionBody;
import com.txtms.domain.request.dto.request.RevisionBody;
import com.txtms.domain.request.dto.request.ScheduleBody;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.service.ContentLockService;
import com.txtms.domain.request.service.ContentRevisionService;
import com.txtms.domain.request.service.ReviewWorkflowService;
import com.txtms.global.security.AuthUser;

/** Assignment and review: assignment, schedule, opinions, questions, recall, edit locks and revisions. */
@RestController
public class ReviewWorkflowController {

    private final ReviewWorkflowService workflow;
    private final ContentLockService locks;
    private final ContentRevisionService revisions;

    public ReviewWorkflowController(ReviewWorkflowService workflow, ContentLockService locks,
            ContentRevisionService revisions) {
        this.workflow = workflow;
        this.locks = locks;
        this.revisions = revisions;
    }

    // ------------------------------------------------------------------ assignment / schedule

    @PostMapping("/api/requests/{id}/assignment")
    public RequestDetail assign(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) AssignmentBody body) {
        return workflow.assign(auth, id, body);
    }

    @PutMapping("/api/requests/{id}/assignment")
    public RequestDetail changeAssignment(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) AssignmentChangeBody body) {
        return workflow.changeAssignment(auth, id, body);
    }

    @PatchMapping("/api/requests/{id}/schedule")
    public RequestDetail reschedule(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) ScheduleBody body) {
        return workflow.reschedule(auth, id, body);
    }

    // ------------------------------------------------------------------ opinions / questions

    @PostMapping("/api/requests/{id}/opinions")
    public RequestDetail addOpinion(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) OpinionBody body) {
        return workflow.addOpinion(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/asks")
    public RequestDetail ask(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) AskBody body) {
        return workflow.ask(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/asks/{askId}/answer")
    public RequestDetail answer(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable long askId, @RequestBody(required = false) AnswerBody body) {
        return workflow.answer(auth, id, askId, body);
    }

    // ------------------------------------------------------------------ recall

    @PostMapping("/api/requests/{id}/recall")
    public RequestDetail requestRecall(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) RecallBody body) {
        return workflow.requestRecall(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/recall/decision")
    public RequestDetail decideRecall(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) RecallDecisionBody body) {
        return workflow.decideRecall(auth, id, body);
    }

    // ------------------------------------------------------------------ locks / revisions

    @PostMapping("/api/requests/{id}/contents/{key}/lock")
    public ContentResponse.Lock acquireLock(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key) {
        return locks.acquire(auth, id, key);
    }

    @DeleteMapping("/api/requests/{id}/contents/{key}/lock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void releaseLock(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key) {
        locks.release(auth, id, key);
    }

    @PostMapping("/api/requests/{id}/contents/{key}/lock/force-release")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forceReleaseLock(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key) {
        locks.forceRelease(auth, id, key);
    }

    @PostMapping("/api/requests/{id}/contents/{key}/revisions")
    public ContentResponse saveRevision(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @RequestBody(required = false) RevisionBody body) {
        return revisions.save(auth, id, key, body);
    }
}
