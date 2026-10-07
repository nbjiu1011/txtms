/** Client checks shared by the customer admin modals (the server re-validates everything). */

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

/** The address is not on the customer's domain (case-insensitive). Empty input is not external. */
export function isExternalEmail(email: string, domain: string): boolean {
  const value = email.trim().toLowerCase();
  if (!value) return false;
  return !value.endsWith(`@${domain.toLowerCase()}`);
}

export const EXTERNAL_DOMAIN_TOAST =
  "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다";
