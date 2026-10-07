package com.txtms.domain.correction.engine;

import java.util.List;

/**
 * One correction target of a text: the span {@code [start, end)} (UTF-16 indices, the same in Java and
 * JavaScript), the matched text, and every rule that proposes something for exactly this span (1:N).
 */
public record Finding(int start, int end, String matchedText, List<Option> options) {

    public Finding {
        options = List.copyOf(options);
    }

    /**
     * A proposal of one rule. {@code recommended} is null for description-only rules (empty or {@code -}
     * recommended value): the screen shows the label and description without an apply button.
     */
    public record Option(String ruleId, String recommended, String descriptionLabel, String description) {
    }
}
