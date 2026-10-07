package com.txtms.domain.request.service;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Per-content lineage of follow-up requests (pure). Every content created by a follow-up records the completed
 * content it came from; following those links up to a content without a source gives the root of its line. The
 * archive groups completed contents by that root ({@code {rootRequestId}:{rootContentKey}}).
 */
public final class ContentLineage {

    /** Longest chain followed; deeper (or cyclic) chains stop at the last content reached. */
    public static final int MAX_DEPTH = 50;

    /** A content of a request. */
    public record Ref(String requestId, String contentKey) {

        public String lineKey() {
            return requestId + ":" + contentKey;
        }
    }

    private ContentLineage() {
    }

    /**
     * Root of the line of {@code start}.
     *
     * @param sources content → the content it was created from (contents without a source are absent)
     */
    public static Ref root(Ref start, Map<Ref, Ref> sources) {
        Ref current = start;
        Set<Ref> seen = new HashSet<>();
        seen.add(current);
        for (int depth = 0; depth < MAX_DEPTH; depth++) {
            Ref parent = sources.get(current);
            if (parent == null || !seen.add(parent)) {
                return current;
            }
            current = parent;
        }
        return current;
    }

    public static String lineKey(Ref start, Map<Ref, Ref> sources) {
        return root(start, sources).lineKey();
    }
}
