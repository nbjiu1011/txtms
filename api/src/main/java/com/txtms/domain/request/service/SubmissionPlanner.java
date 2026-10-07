package com.txtms.domain.request.service;

/**
 * Content version decision on submit (round handling lives in {@code Request#submit}).
 * <ul>
 * <li>First submit: every content becomes version 1 with a snapshot.</li>
 * <li>Resubmit (after a cancel or an approved recall): a content whose title, payload or files differ from its last
 * snapshot gets version + 1 and a new snapshot; a content added since has no snapshot yet and gets one at its
 * current version; unchanged contents keep their version.</li>
 * </ul>
 */
public final class SubmissionPlanner {

    public enum VersionStep {
        /** First submission: version 1 and snapshot. */
        START,
        /** Changed since the last snapshot: version + 1 and snapshot. */
        BUMP,
        /** No snapshot yet (added after the first submission): snapshot at the current version. */
        SNAPSHOT,
        /** Unchanged. */
        KEEP
    }

    private SubmissionPlanner() {
    }

    /**
     * @param current      fingerprint of the current content (title, payload, files), compared with equals
     * @param lastSnapshot fingerprint of the latest snapshot, or null when there is none
     */
    public static VersionStep versionStep(boolean firstSubmit, Object current, Object lastSnapshot) {
        if (firstSubmit) {
            return VersionStep.START;
        }
        if (lastSnapshot == null) {
            return VersionStep.SNAPSHOT;
        }
        return java.util.Objects.equals(current, lastSnapshot) ? VersionStep.KEEP : VersionStep.BUMP;
    }
}
