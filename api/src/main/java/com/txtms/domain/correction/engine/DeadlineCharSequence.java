package com.txtms.domain.correction.engine;

/**
 * Text view for regular expression matching that gives up after a deadline. Operator datasets may contain patterns
 * with catastrophic backtracking; {@link java.util.regex.Matcher} reads the input only through {@link #charAt}, so
 * checking the clock there (every 1,024 reads) bounds the time one rule may spend on one field.
 */
final class DeadlineCharSequence implements CharSequence {

    /** Thrown when a rule exceeds its time budget. */
    static final class TimeoutException extends RuntimeException {
        TimeoutException() {
            super("correction rule timed out", null, false, false);
        }
    }

    private final CharSequence text;
    private final long deadlineNanos;
    private int reads;

    DeadlineCharSequence(CharSequence text, long deadlineNanos) {
        this.text = text;
        this.deadlineNanos = deadlineNanos;
    }

    @Override
    public int length() {
        return text.length();
    }

    @Override
    public char charAt(int index) {
        if ((++reads & 0x3FF) == 0 && System.nanoTime() - deadlineNanos > 0) {
            throw new TimeoutException();
        }
        return text.charAt(index);
    }

    @Override
    public CharSequence subSequence(int start, int end) {
        return text.subSequence(start, end);
    }

    @Override
    public String toString() {
        return text.toString();
    }
}
