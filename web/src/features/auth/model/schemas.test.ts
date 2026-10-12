import { describe, expect, it } from "vitest";
import {
  PASSWORD_POLICY_ERROR,
  loginSchema,
  passwordChangeSchema,
  passwordMeetsPolicy,
  passwordResetRequestSchema,
  tokenPasswordSchema,
} from "./schemas";

describe("password policy", () => {
  it("needs 8+ characters with two of letters, digits, symbols", () => {
    expect(passwordMeetsPolicy("abcd1234")).toBe(true);
    expect(passwordMeetsPolicy("abcd!@#$")).toBe(true);
    expect(passwordMeetsPolicy("1234!@#$")).toBe(true);
    expect(passwordMeetsPolicy("abcdefgh")).toBe(false);
    expect(passwordMeetsPolicy("abc123")).toBe(false);
  });
});

describe("auth schemas use contract keys", () => {
  it("login", () => {
    expect(loginSchema.safeParse({ email: " a@b.co ", password: "x", remember: true })).toMatchObject({
      success: true,
      data: { email: "a@b.co", password: "x", remember: true },
    });
    expect(loginSchema.safeParse({ email: "nope", password: "", remember: false }).success).toBe(false);
  });

  it("password reset request", () => {
    expect(passwordResetRequestSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(passwordResetRequestSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("password change: contract keys, policy, confirmation and a new value", () => {
    const ok = passwordChangeSchema.safeParse({
      currentPassword: "Txtms!2026",
      newPassword: "Changed#2026",
      newPasswordConfirm: "Changed#2026",
    });
    expect(ok).toMatchObject({ success: true, data: { currentPassword: "Txtms!2026", newPassword: "Changed#2026" } });

    const issues = (values: Record<string, string>) => {
      const result = passwordChangeSchema.safeParse(values);
      return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
    };
    expect(issues({ currentPassword: "", newPassword: "Changed#2026", newPasswordConfirm: "Changed#2026" })).toEqual({
      currentPassword: "현재 비밀번호를 입력하세요",
    });
    expect(issues({ currentPassword: "x", newPassword: "abcdefgh", newPasswordConfirm: "abcdefgh" })).toEqual({
      newPassword: PASSWORD_POLICY_ERROR,
    });
    expect(issues({ currentPassword: "x", newPassword: "Changed#2026", newPasswordConfirm: "Changed#2027" })).toEqual({
      newPasswordConfirm: "새 비밀번호가 일치하지 않습니다",
    });
    expect(
      issues({ currentPassword: "Txtms!2026", newPassword: "Txtms!2026", newPasswordConfirm: "Txtms!2026" }),
    ).toEqual({ newPassword: "현재 비밀번호와 다른 비밀번호를 입력하세요" });
  });

  it("token password", () => {
    expect(tokenPasswordSchema.safeParse({ name: "홍길동", password: "abcd1234" }).success).toBe(true);
    expect(tokenPasswordSchema.safeParse({ name: " ", password: "abcd1234" }).success).toBe(false);
    expect(tokenPasswordSchema.safeParse({ name: "홍길동", password: "short" }).success).toBe(false);
  });
});
