/** `#{key}` token of a project variable inside content text. */
export function variableToken(key: string): string {
  return `#{${key}}`;
}

export interface InsertResult {
  value: string;
  /** Caret position right after the inserted token. */
  caret: number;
}

/**
 * Inserts `#{key}` at the caret of a text field, replacing the selected text (reference `insVar`).
 * Positions outside the value are clamped; without a known caret the token goes to the end.
 */
export function insertToken(value: string, key: string, start?: number | null, end?: number | null): InsertResult {
  const token = variableToken(key);
  const from = start === null || start === undefined ? value.length : Math.max(0, Math.min(value.length, start));
  const to = end === null || end === undefined ? from : Math.max(from, Math.min(value.length, end));
  return { value: value.slice(0, from) + token + value.slice(to), caret: from + token.length };
}
