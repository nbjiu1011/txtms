/**
 * Server message of an invitation to an address outside the customer's domain without confirmation
 * (`EXTERNAL_DOMAIN_CONFIRM_REQUIRED`, contract §11/§12). The web asks the same once before sending.
 */
export const EXTERNAL_DOMAIN_TOAST =
  "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다";

/** The same confirmation for 사용자 이메일 변경 — the server's own wording of that 409 (contract §14.6). */
export const EMAIL_CHANGE_EXTERNAL_TOAST = "회사 도메인이 아닌 이메일입니다. 확인 후 다시 저장하세요";
