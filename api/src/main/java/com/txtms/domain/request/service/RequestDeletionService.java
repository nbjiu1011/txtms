package com.txtms.domain.request.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.security.AuthUser;

/**
 * A requester deletes a draft created by mistake (contract §21): only a draft that was never submitted
 * ({@link RequestAction#DELETE}), so no workflow history, assignment or notification is lost. The request and its
 * rows are removed physically; the deletion itself stays in the audit log.
 */
@Service
@Transactional
public class RequestDeletionService {

    private final RequestWriteSupport support;
    private final RequestPurger purger;
    private final AuditLogService audit;

    public RequestDeletionService(RequestWriteSupport support, RequestPurger purger, AuditLogService audit) {
        this.support = support;
        this.purger = purger;
        this.audit = audit;
    }

    public void delete(AuthUser auth, String id) {
        RequestWriteSupport.Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.DELETE);
        Request r = ctx.request();
        purger.purge(List.of(r.getId()));
        audit.record(ctx.user().getId(), ctx.project().getCustomerId(), "요청 삭제", r.getId(),
                r.getTitle().isBlank() ? null : r.getTitle());
    }
}
