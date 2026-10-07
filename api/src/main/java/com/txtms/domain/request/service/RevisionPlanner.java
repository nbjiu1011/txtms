package com.txtms.domain.request.service;

import java.util.Objects;

import com.txtms.domain.request.entity.RequestStatus;

/**
 * Decision of a saved revision (review or answering).
 * <ul>
 * <li>Only a real change opens a new content version: title, payload, or attachments (file revision version and
 * amounts) different from the latest snapshot. Saving the same content keeps the version.</li>
 * <li>While the requester answers ({@code CONFIRMING}), a change of the text (title or payload) marks the answer as
 * changed, so the answer opens a new review round. Attachment amounts alone do not ("문안을 수정하면").</li>
 * </ul>
 */
public final class RevisionPlanner {

    /** {@code changed}: new version; {@code markAnswerChanged}: the next answer opens a new round. */
    public record Outcome(boolean changed, boolean markAnswerChanged) {
    }

    private RevisionPlanner() {
    }

    /**
     * @param proposed     fingerprint of the saved state (title, payload, files)
     * @param baseline     fingerprint of the latest snapshot
     * @param proposedText fingerprint of the saved title and payload
     * @param baselineText fingerprint of the current title and payload
     */
    public static Outcome plan(RequestStatus status, Object proposed, Object baseline, Object proposedText,
            Object baselineText) {
        boolean changed = !Objects.equals(proposed, baseline);
        boolean textChanged = !Objects.equals(proposedText, baselineText);
        return new Outcome(changed, changed && textChanged && status == RequestStatus.CONFIRMING);
    }
}
