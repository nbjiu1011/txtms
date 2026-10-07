import { isApiError } from "./api-error";

/** A failed write split for display: toast message, inline field messages, detail list. */
export interface ServerFormError {
  code: string;
  message: string;
  /** Contract field key → first message (`fieldErrors`). */
  fields: Record<string, string>;
  /** Human readable items (`details`), e.g. the blocking requests of a deactivation. */
  details: string[];
}

/** Normalises any thrown error of a form submit (non-API errors get `fallback`). */
export function serverFormError(error: unknown, fallback: string): ServerFormError {
  if (!isApiError(error)) return { code: "NETWORK_ERROR", message: fallback, fields: {}, details: [] };
  const fields: Record<string, string> = {};
  for (const fe of error.fieldErrors) {
    if (!(fe.field in fields)) fields[fe.field] = fe.message;
  }
  return { code: error.code, message: error.message || fallback, fields, details: error.details };
}
