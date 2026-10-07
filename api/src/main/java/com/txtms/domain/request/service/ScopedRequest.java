package com.txtms.domain.request.service;

import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.policy.RequestFacts;

/** A request together with the policy facts of itself and its project. */
public record ScopedRequest(Request request, ProjectFacts project, RequestFacts facts) {

    public static ScopedRequest of(Request request, ProjectFacts project) {
        return new ScopedRequest(request, project, RequestFacts.of(request));
    }
}
