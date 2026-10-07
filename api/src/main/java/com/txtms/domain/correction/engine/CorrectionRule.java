package com.txtms.domain.correction.engine;

/**
 * One row of a correction dataset in the seven columns of the correction engine specification V0.5 §3.
 * Exactly one of {@code originalExpr} / {@code originalPattern} is set. The recommended value is
 * {@code recommendedExpr} for an expression rule and {@code recommendedPattern} for a pattern rule; an empty value
 * or {@code -} means "description only" (no replacement is offered). Expressions keep their leading and trailing
 * spaces (they are part of the match).
 */
public record CorrectionRule(
        String ruleId,
        String originalExpr,
        String recommendedExpr,
        String originalPattern,
        String recommendedPattern,
        String descriptionLabel,
        String description) {

    /** The "no recommendation" marker of the client datasets. */
    public static final String NO_RECOMMENDATION = "-";

    /** A cell counts as filled when it has a non-blank character (whitespace-only cells are empty). */
    public static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    /** A recommended value that offers a replacement (filled and not {@code -}). */
    public static boolean offersReplacement(String recommended) {
        return present(recommended) && !NO_RECOMMENDATION.equals(recommended.strip());
    }

    public boolean expressionRule() {
        return present(originalExpr);
    }

    public boolean patternRule() {
        return present(originalPattern);
    }
}
