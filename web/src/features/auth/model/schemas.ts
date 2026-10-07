import * as z from "zod/mini";

/** 8+ characters with at least two of: letters, digits, symbols (contract §1). */
export const PASSWORD_POLICY_TEXT = "8자 이상, 영문·숫자·특수문자 중 2종 이상";
export const PASSWORD_POLICY_ERROR = "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다";

export function passwordMeetsPolicy(password: string): boolean {
  if (password.length < 8) return false;
  const kinds = [/[A-Za-z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  return kinds >= 2;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keys = `POST /api/auth/login` body keys. */
export const loginSchema = z.object({
  email: z.string().check(z.trim(), z.minLength(1, "이메일을 입력하세요"), z.regex(EMAIL, "이메일 형식을 확인하세요")),
  password: z.string().check(z.minLength(1, "비밀번호를 입력하세요")),
  remember: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** Keys = `POST /api/auth/password-reset-requests` body keys. */
export const passwordResetRequestSchema = z.object({
  email: z.string().check(z.trim(), z.minLength(1, "이메일을 입력하세요"), z.regex(EMAIL, "이메일 형식을 확인하세요")),
});
export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;

/** Keys = `POST /api/auth/tokens/{token}/password` body keys. */
export const tokenPasswordSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "이름을 입력하세요")),
  password: z.string().check(z.refine(passwordMeetsPolicy, PASSWORD_POLICY_ERROR)),
});
export type TokenPasswordValues = z.infer<typeof tokenPasswordSchema>;

/** Password reset: the name is not editable (and ignored by the server). */
export const passwordResetSchema = z.object({
  name: z.optional(z.string()),
  password: z.string().check(z.refine(passwordMeetsPolicy, PASSWORD_POLICY_ERROR)),
});
