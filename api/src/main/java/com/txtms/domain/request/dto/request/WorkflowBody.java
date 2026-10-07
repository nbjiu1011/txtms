package com.txtms.domain.request.dto.request;

/** Body of workflow POSTs: the {@code rowVersion} of the detail the user acted on. */
public record WorkflowBody(Long rowVersion) {
}
