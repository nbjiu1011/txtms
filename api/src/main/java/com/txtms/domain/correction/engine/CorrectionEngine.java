package com.txtms.domain.correction.engine;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Correction engine of the specification V0.5 (actions.md §6.7). Pure Java, immutable and thread-safe once
 * compiled.
 *
 * <pre>
 * run(text):
 *   blank text                      → no findings (§5)
 *   ① original_expr occurrences     → candidate (original, recommended_expr | null)
 *   ② recommended_expr occurrences  → protector candidate (text, text): isSameExpr = true
 *   ③ original_pattern matches      → candidate (match, expanded recommended_pattern | null)
 *   4.4.1 drop every candidate whose span lies inside a strictly longer candidate span (same spans all stay)
 *   4.4.2 drop candidates whose detected text equals the recommendation (protectors included), case-sensitive
 *   4.5   group the rest by identical span (1:N), ordered by start, then end
 * </pre>
 *
 * Partially overlapping candidates that do not contain one another are all reported (§5 "모두 노출"). Matching is
 * case-sensitive; patterns use {@link Pattern} without flags ({@code \d} stays ASCII, no
 * {@code UNICODE_CHARACTER_CLASS}). Occurrences of one expression or pattern do not overlap (scanned left to right).
 * Indices are UTF-16 code units. A pattern rule that exceeds the time budget on a field contributes nothing for that
 * field (logged).
 */
public final class CorrectionEngine {

    private static final Logger log = LoggerFactory.getLogger(CorrectionEngine.class);

    /** A rule ready to run: expression rules have no pattern; {@code recommended} is null for description-only. */
    private record Compiled(CorrectionRule rule, Pattern pattern, ReplacementTemplate template, String recommended,
            String protector) {
    }

    private record Candidate(Compiled source, int start, int end, String detected, String recommended,
            boolean protector) {
    }

    private final List<Compiled> rules;
    private final long timeoutNanos;

    private CorrectionEngine(List<Compiled> rules, Duration ruleTimeout) {
        this.rules = rules;
        this.timeoutNanos = ruleTimeout.toNanos();
    }

    /**
     * Compiles the rules in dataset order. Invalid rules (which the importer rejects) are skipped with a warning so a
     * single bad row never disables a whole dataset.
     */
    public static CorrectionEngine compile(List<CorrectionRule> rules, Duration ruleTimeout) {
        List<Compiled> compiled = new ArrayList<>(rules.size());
        for (CorrectionRule rule : rules) {
            try {
                compiled.add(compileRule(rule));
            } catch (IllegalArgumentException e) {
                log.warn("Correction rule {} skipped: {}", rule.ruleId(), e.getMessage());
            }
        }
        return new CorrectionEngine(List.copyOf(compiled), ruleTimeout);
    }

    /**
     * Checks one rule the way the engine will run it. Messages are the importer's row errors.
     *
     * @throws IllegalArgumentException when the rule cannot run
     */
    public static void validate(CorrectionRule rule) {
        compileRule(rule);
    }

    private static Compiled compileRule(CorrectionRule rule) {
        boolean expr = rule.expressionRule();
        boolean pattern = rule.patternRule();
        if (expr == pattern) {
            throw new IllegalArgumentException("original_expr와 original_pattern 중 하나만 입력하세요");
        }
        if (expr) {
            if (CorrectionRule.present(rule.recommendedPattern())) {
                throw new IllegalArgumentException("original_expr 규칙의 권장 값은 recommended_expr에 입력하세요");
            }
            String recommended = CorrectionRule.offersReplacement(rule.recommendedExpr()) ? rule.recommendedExpr()
                    : null;
            return new Compiled(rule, null, null, recommended, recommended);
        }
        if (CorrectionRule.present(rule.recommendedExpr())) {
            throw new IllegalArgumentException("original_pattern 규칙의 권장 값은 recommended_pattern에 입력하세요");
        }
        Pattern p;
        try {
            p = Pattern.compile(rule.originalPattern());
        } catch (PatternSyntaxException e) {
            throw new IllegalArgumentException("original_pattern 정규식 오류: " + e.getDescription()
                    + (e.getIndex() >= 0 ? " (위치 " + e.getIndex() + ")" : ""));
        }
        ReplacementTemplate template = null;
        if (CorrectionRule.offersReplacement(rule.recommendedPattern())) {
            try {
                template = ReplacementTemplate.parse(rule.recommendedPattern(), p.matcher("").groupCount());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("recommended_pattern이 " + e.getMessage());
            }
        }
        return new Compiled(rule, p, template, null, null);
    }

    public int ruleCount() {
        return rules.size();
    }

    /** Findings of one text field, ordered by start then end. */
    public List<Finding> run(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<Candidate> candidates = new ArrayList<>();
        for (Compiled rule : rules) {
            if (rule.pattern() == null) {
                collectExpression(text, rule, candidates);
            } else {
                collectPattern(text, rule, candidates);
            }
        }
        List<Candidate> kept = new ArrayList<>();
        for (Candidate c : longestMatchesOnly(candidates)) {
            if (!c.protector() && !(c.recommended() != null && c.detected().equals(c.recommended()))) {
                kept.add(c);
            }
        }
        return group(text, kept);
    }

    // ------------------------------------------------------------------ ①② expressions, ③ patterns

    private static void collectExpression(String text, Compiled rule, List<Candidate> out) {
        String original = rule.rule().originalExpr();
        for (int s = text.indexOf(original); s >= 0; s = text.indexOf(original, s + original.length())) {
            out.add(new Candidate(rule, s, s + original.length(), original, rule.recommended(), false));
        }
        String protector = rule.protector();
        if (protector != null) {
            for (int s = text.indexOf(protector); s >= 0; s = text.indexOf(protector, s + protector.length())) {
                out.add(new Candidate(rule, s, s + protector.length(), protector, protector, true));
            }
        }
    }

    private void collectPattern(String text, Compiled rule, List<Candidate> out) {
        List<Candidate> found = new ArrayList<>();
        try {
            Matcher m = rule.pattern().matcher(new DeadlineCharSequence(text, System.nanoTime() + timeoutNanos));
            while (m.find()) {
                if (m.end() == m.start()) {
                    continue;
                }
                String recommended = rule.template() == null ? null : rule.template().expand(m);
                found.add(new Candidate(rule, m.start(), m.end(), text.substring(m.start(), m.end()), recommended,
                        false));
            }
            out.addAll(found);
        } catch (DeadlineCharSequence.TimeoutException e) {
            log.warn("Correction rule {} exceeded {} ms on a text of {} characters; skipped", rule.rule().ruleId(),
                    timeoutNanos / 1_000_000, text.length());
        }
    }

    // ------------------------------------------------------------------ 4.4.1 longest match

    /**
     * Removes candidates whose span is properly contained in another candidate's span (strictly longer, so equal
     * spans all stay). Containers count even when they are removed themselves or are protectors. Sweep in
     * (start asc, end desc) order: every earlier distinct span starts at or before the current one, and a same-start
     * earlier span ends later, so the current span is properly contained exactly when an earlier distinct span ends
     * at or after it.
     */
    private static List<Candidate> longestMatchesOnly(List<Candidate> candidates) {
        List<Candidate> sorted = new ArrayList<>(candidates);
        sorted.sort(Comparator.comparingInt(Candidate::start).thenComparing(Candidate::end, Comparator.reverseOrder()));
        List<Candidate> kept = new ArrayList<>();
        int maxEnd = -1;
        int i = 0;
        while (i < sorted.size()) {
            int start = sorted.get(i).start();
            int end = sorted.get(i).end();
            int j = i;
            while (j < sorted.size() && sorted.get(j).start() == start && sorted.get(j).end() == end) {
                j++;
            }
            if (maxEnd < end) {
                kept.addAll(sorted.subList(i, j));
            }
            maxEnd = Math.max(maxEnd, end);
            i = j;
        }
        return kept;
    }

    // ------------------------------------------------------------------ 4.5 grouping

    private static List<Finding> group(String text, List<Candidate> candidates) {
        Map<Long, List<Candidate>> bySpan = new LinkedHashMap<>();
        candidates.stream()
                .sorted(Comparator.comparingInt(Candidate::start).thenComparingInt(Candidate::end))
                .forEach(c -> bySpan.computeIfAbsent(((long) c.start() << 32) | c.end(), k -> new ArrayList<>())
                        .add(c));
        List<Finding> findings = new ArrayList<>(bySpan.size());
        for (List<Candidate> same : bySpan.values()) {
            Candidate first = same.getFirst();
            List<Finding.Option> options = same.stream()
                    .map(c -> new Finding.Option(c.source().rule().ruleId(), c.recommended(),
                            c.source().rule().descriptionLabel(), c.source().rule().description()))
                    .toList();
            findings.add(new Finding(first.start(), first.end(), text.substring(first.start(), first.end()),
                    options));
        }
        return findings;
    }
}
