import * as z from "zod/mini";
import { VARIABLE_TYPES, type VariableType } from "@/entities/variable";

export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]+$/;

/** Value check per variable type (same wording as the server). Null when valid. */
export function variableValueError(type: VariableType, value: string): string | null {
  const v = value.trim();
  if (!v) return "값을 입력하세요";
  if (type === "NUMBER") return Number.isFinite(Number(v)) ? null : "정수 또는 소수를 입력하세요";
  if (type === "DATE") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return "유효한 YYYY-MM-DD 날짜를 입력하세요";
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toISOString().slice(0, 10) === v ? null : "유효한 YYYY-MM-DD 날짜를 입력하세요";
  }
  if (type === "LINK") {
    try {
      const url = new URL(v);
      return url.protocol === "http:" || url.protocol === "https:" ? null : "HTTP/HTTPS 링크를 입력하세요";
    } catch {
      return "유효한 링크를 입력하세요";
    }
  }
  return v.length > 1000 ? "값은 최대 1,000자입니다" : null;
}

/** Keys = `POST /api/projects/{id}/variables` body keys. The server re-validates (and checks duplicates). */
export const variableRegisterSchema = z
  .object({
    key: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, "변수 키를 입력하세요"),
        z.maxLength(64, "변수 키는 최대 64자입니다"),
        z.regex(VARIABLE_KEY_PATTERN, "변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요"),
      ),
    type: z.enum(VARIABLE_TYPES),
    description: z.string().check(z.trim(), z.maxLength(200, "설명은 최대 200자입니다")),
    value: z.string().check(z.trim()),
  })
  .check(
    z.superRefine((v, ctx) => {
      const message = variableValueError(v.type, v.value);
      if (message) ctx.issues.push({ code: "custom", message, path: ["value"], input: v.value });
    }),
  );
export type VariableRegisterValues = z.infer<typeof variableRegisterSchema>;
