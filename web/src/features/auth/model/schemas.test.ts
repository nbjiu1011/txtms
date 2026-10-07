import { describe, expect, it } from "vitest";
import { loginSchema, passwordMeetsPolicy, passwordResetRequestSchema, tokenPasswordSchema } from "./schemas";

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

  it("token password", () => {
    expect(tokenPasswordSchema.safeParse({ name: "홍길동", password: "abcd1234" }).success).toBe(true);
    expect(tokenPasswordSchema.safeParse({ name: " ", password: "abcd1234" }).success).toBe(false);
    expect(tokenPasswordSchema.safeParse({ name: "홍길동", password: "short" }).success).toBe(false);
  });
});
