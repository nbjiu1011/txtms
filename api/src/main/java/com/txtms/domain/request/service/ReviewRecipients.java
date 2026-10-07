package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Recipients of the review workflow notifications (pure). Every list is de-duplicated in first-seen order; the
 * acting user is removed by {@link #finalRecipients} when the notifications are written.
 */
public final class ReviewRecipients {

    private ReviewRecipients() {
    }

    /** Recipients of one event: duplicates and nulls removed, the actor never notifies themselves. */
    public static List<Long> finalRecipients(Collection<Long> userIds, Long actorId) {
        return userIds.stream().filter(Objects::nonNull).distinct().filter(id -> !id.equals(actorId)).toList();
    }

    /** First assignment: the requester and the assigned reviewers. */
    public static List<Long> assignment(long requesterId, List<Long> reviewers) {
        return union(List.of(requesterId), reviewers);
    }

    /**
     * Reviewer or primary change: the requester, reviewers added or removed, the previous and the new primary
     * (reviewers whose assignment did not change are not notified).
     */
    public static List<Long> assignmentChange(long requesterId, List<Long> before, Long beforePrimary,
            List<Long> after, Long afterPrimary) {
        List<Long> added = after.stream().filter(id -> !before.contains(id)).toList();
        List<Long> removed = before.stream().filter(id -> !after.contains(id)).toList();
        List<Long> primaries = new ArrayList<>();
        primaries.add(beforePrimary);
        primaries.add(afterPrimary);
        return union(List.of(requesterId), added, removed, primaries);
    }

    /**
     * Recall requested: the primary reviewer must decide ({@code RECALL}); the other assigned reviewers and the
     * lead reviewer are informed once ({@code INFO}), never twice when they are also the primary.
     */
    public record Recall(List<Long> decider, List<Long> informed) {
    }

    public static Recall recall(Long primaryId, List<Long> reviewers, Long leadId, Long actorId) {
        List<Long> decider = finalRecipients(primaryId == null ? List.of() : List.of(primaryId), actorId);
        List<Long> others = new ArrayList<>(reviewers);
        others.add(leadId);
        List<Long> informed = finalRecipients(others, actorId).stream()
                .filter(id -> !id.equals(primaryId)).toList();
        return new Recall(decider, informed);
    }

    /** Recall approved or rejected: the requester, the assigned reviewers and the lead (assignment before it). */
    public static List<Long> recallDecision(long requesterId, List<Long> reviewers, Long leadId) {
        return union(List.of(requesterId), reviewers, single(leadId));
    }

    /** Due date change: the requester, the lead reviewer and the assigned reviewers. */
    public static List<Long> dueChange(long requesterId, Long leadId, List<Long> reviewers) {
        return union(List.of(requesterId), single(leadId), reviewers);
    }

    private static List<Long> single(Long id) {
        List<Long> list = new ArrayList<>();
        list.add(id);
        return list;
    }

    @SafeVarargs
    private static List<Long> union(Collection<Long>... groups) {
        Set<Long> out = new LinkedHashSet<>();
        for (Collection<Long> g : groups) {
            g.stream().filter(Objects::nonNull).forEach(out::add);
        }
        return List.copyOf(out);
    }
}
