import type { Variable, VariablePatch, VariableType } from "@/entities/variable";

export interface VariableForm {
  key: string;
  description: string;
  type: VariableType;
  value: string;
  active: boolean;
}

export function initialVariableForm(variable: Variable | null): VariableForm {
  if (!variable) return { key: "", description: "", type: "TEXT", value: "", active: true };
  const { key, description, type, value, active } = variable;
  return { key, description, type, value, active };
}

/** Value check per type (reference `checkVariable`, same wording as the server). Text accepts anything. */
export function variableValueProblem(type: VariableType, value: string): string | null {
  const v = value.trim();
  if (type === "NUMBER") return v && Number.isFinite(Number(v)) ? null : "정수 또는 소수를 입력하세요";
  if (type === "DATE") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const ok = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === v;
    return ok ? null : "유효한 YYYY-MM-DD 날짜를 입력하세요";
  }
  if (type === "LINK") {
    try {
      const protocol = new URL(v).protocol;
      return protocol === "http:" || protocol === "https:" ? null : "HTTP/HTTPS 링크를 입력하세요";
    } catch {
      return "유효한 링크를 입력하세요";
    }
  }
  return null;
}

/**
 * Reference order: key format, value per type, then (edit) the key of a variable in use cannot change.
 * Duplicates are left to the server (it also knows deleted keys, which stay reserved).
 */
export function variableFormProblem(form: VariableForm, variable: Variable | null): string | null {
  const key = form.key.trim();
  if (!/^[a-z0-9_]+$/.test(key)) return "변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요";
  const valueProblem = variableValueProblem(form.type, form.value);
  if (valueProblem) return valueProblem;
  if (variable && variable.inUse && variable.key !== key) return "사용 중인 변수는 키를 변경할 수 없습니다";
  return null;
}

/** Changed keys only (`PATCH /api/variables/{id}`); an unchanged key is not sent. */
export function variablePatch(form: VariableForm, variable: Variable): VariablePatch {
  const patch: VariablePatch = {};
  const key = form.key.trim();
  if (key !== variable.key) patch.key = key;
  if (form.description !== variable.description) patch.description = form.description;
  if (form.type !== variable.type) patch.type = form.type;
  if (form.value !== variable.value) patch.value = form.value;
  if (form.active !== variable.active) patch.active = form.active;
  return patch;
}

/** 사용 column: `활성` / `중지`, plus ` · 사용 중` while a current content uses the key. */
export function variableUsageText(variable: Pick<Variable, "active" | "inUse">): string {
  return `${variable.active ? "활성" : "중지"}${variable.inUse ? " · 사용 중" : ""}`;
}
