/** Client checks shared by the admin modals (the server re-validates everything). */

/** First empty field as the reference toast `{label}을(를) 입력하세요` (`need`), else null. */
export function firstMissing(fields: [value: string | number | null | undefined, label: string][]): string | null {
  for (const [value, label] of fields) {
    if (value === null || value === undefined || String(value).trim() === "") return `${label}을(를) 입력하세요`;
  }
  return null;
}

/** Reference email pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$`. */
export function isEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** The address is not on the company domain (case-insensitive). Empty input is not external. */
export function isExternalEmail(email: string, domain: string): boolean {
  const value = email.trim().toLowerCase();
  if (!value) return false;
  return !value.endsWith(`@${domain.toLowerCase()}`);
}

/** Trimmed, lower-cased email (the form the server stores and compares). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
