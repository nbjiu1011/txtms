package com.txtms.domain.request.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.common.Kst;

import tools.jackson.databind.JsonNode;

/**
 * Completed-content archive (pure): completed bundle items grouped by content line, the latest completion first,
 * older completions and open follow-up requests attached, filters applied to the latest completion of each line.
 */
public final class ArchiveLines {

    /** Preview length of text contents. */
    public static final int PREVIEW_LENGTH = 140;

    /** One completed content (a bundle item of a finally completed request). */
    public record Completed(String lineKey, String requestId, String requestTitle, ContentType type,
            RequestStatus status, Instant completedAt, String campaign, String contentKey, String title, int version,
            JsonNode payload, List<FileRef> files, Map<String, String> frozenValues) {

        public Completed {
            files = List.copyOf(files);
        }
    }

    /** An attachment of a completed content as frozen in the bundle. */
    public record FileRef(String name, int version) {
    }

    /** A request that is not finally completed and has a content derived from the line. */
    public record FollowUp(String lineKey, String requestId, RequestStatus status, String title, Instant createdAt) {
    }

    /** Archive filters (all optional). Dates are KST calendar dates, both ends included. */
    public record Criteria(String q, ContentType type, String campaign, RequestStatus status, LocalDate from,
            LocalDate to) {
    }

    public record Line(String lineKey, Completed latest, List<Completed> past, List<FollowUp> followUps,
            List<String> campaigns) {
    }

    private static final Comparator<Completed> NEWEST_FIRST = Comparator
            .comparing(Completed::completedAt).thenComparing(Completed::requestId).reversed();

    private ArchiveLines() {
    }

    /** Lines whose latest completion matches the criteria, newest latest completion first. */
    public static List<Line> build(List<Completed> completed, List<FollowUp> followUps, Criteria criteria) {
        Map<String, List<Completed>> byLine = new LinkedHashMap<>();
        completed.forEach(c -> byLine.computeIfAbsent(c.lineKey(), k -> new ArrayList<>()).add(c));
        Map<String, List<FollowUp>> followUpsByLine = new LinkedHashMap<>();
        followUps.stream()
                .sorted(Comparator.comparing(FollowUp::createdAt).thenComparing(FollowUp::requestId).reversed())
                .forEach(f -> {
                    List<FollowUp> list = followUpsByLine.computeIfAbsent(f.lineKey(), k -> new ArrayList<>());
                    if (list.stream().noneMatch(x -> x.requestId().equals(f.requestId()))) {
                        list.add(f);
                    }
                });
        List<Line> lines = new ArrayList<>();
        byLine.forEach((key, items) -> {
            List<Completed> sorted = items.stream().sorted(NEWEST_FIRST).toList();
            Completed latest = sorted.getFirst();
            if (!matches(latest, criteria)) {
                return;
            }
            Set<String> campaigns = new LinkedHashSet<>();
            sorted.stream().map(Completed::campaign).filter(c -> c != null && !c.isBlank()).forEach(campaigns::add);
            lines.add(new Line(key, latest, sorted.subList(1, sorted.size()),
                    followUpsByLine.getOrDefault(key, List.of()), List.copyOf(campaigns)));
        });
        lines.sort(Comparator.comparing((Line l) -> l.latest().completedAt(), Comparator.reverseOrder())
                .thenComparing(l -> l.latest().requestId(), Comparator.reverseOrder())
                .thenComparingInt(l -> com.txtms.domain.request.entity.Content.keyNumber(l.latest().contentKey())));
        return lines;
    }

    public static boolean matches(Completed c, Criteria criteria) {
        if (criteria == null) {
            return true;
        }
        if (criteria.q() != null && !criteria.q().isBlank()) {
            String needle = criteria.q().trim().toLowerCase(Locale.ROOT);
            if (!searchText(c).contains(needle)) {
                return false;
            }
        }
        if (criteria.type() != null && c.type() != criteria.type()) {
            return false;
        }
        if (criteria.campaign() != null && !criteria.campaign().isBlank()
                && !Objects.equals(criteria.campaign(), c.campaign())) {
            return false;
        }
        if (criteria.status() != null && c.status() != criteria.status()) {
            return false;
        }
        LocalDate day = Kst.dateOf(c.completedAt());
        return (criteria.from() == null || !day.isBefore(criteria.from()))
                && (criteria.to() == null || !day.isAfter(criteria.to()));
    }

    /** Item title, text fields, attachment names and the request title, lower-cased. */
    static String searchText(Completed c) {
        List<String> parts = new ArrayList<>();
        parts.add(c.title());
        parts.addAll(ContentTexts.textFields(c.type(), c.payload()));
        c.files().forEach(f -> parts.add(f.name()));
        parts.add(c.requestTitle());
        return String.join(" ", parts.stream().filter(Objects::nonNull).toList()).toLowerCase(Locale.ROOT);
    }

    /** Body with the variable tokens replaced by the values frozen in the bundle. */
    public static String resolvedText(Completed c) {
        return ContentTexts.resolve(ContentTexts.body(c.type(), c.payload()), c.frozenValues());
    }

    /** Attachment names with versions, or the first characters of the resolved text. */
    public static String preview(Completed c) {
        if (!c.files().isEmpty()) {
            return String.join(", ", c.files().stream().map(f -> f.name() + " (v" + f.version() + ")").toList());
        }
        String text = resolvedText(c);
        return text.length() <= PREVIEW_LENGTH ? text : text.substring(0, PREVIEW_LENGTH);
    }
}
