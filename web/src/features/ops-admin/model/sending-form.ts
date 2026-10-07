import type { ProjectTemplate } from "@/entities/project";

/** Editable rows of the 발신 정보 editor (contract §12 `PUT /api/ops/projects/{id}/templates|senders`). */
export interface SendingForm {
  templates: ProjectTemplate[];
  senders: string[];
}

export const MAX_TEMPLATES = 100;
export const MAX_SENDERS = 50;
const CODE = /^[A-Za-z0-9_-]+$/;
const SENDER = /^(0\d{1,2}-?\d{3,4}-?\d{4}|1\d{3}-?\d{4})$/;
export const SENDER_FORMAT_MESSAGE = "발신번호 형식을 확인하세요 (예: 1588-0000, 02-3456-7000)";

/**
 * Same checks and messages as the API, keyed like its `fieldErrors` (`templates.{i}.code|name`,
 * `senders.{i}`) so client and server refusals land under the same row. Values are trimmed.
 */
export function sendingProblems(form: SendingForm): Record<string, string> {
  const problems: Record<string, string> = {};
  const codes = new Set<string>();
  form.templates.forEach((t, i) => {
    const code = t.code.trim();
    const name = t.name.trim();
    const key = `templates.${i}`;
    if (!code) problems[`${key}.code`] = "템플릿 코드를 입력하세요";
    else if (code.length > 50) problems[`${key}.code`] = "템플릿 코드는 최대 50자입니다";
    else if (!CODE.test(code)) problems[`${key}.code`] = "템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다";
    else if (codes.has(code.toLowerCase())) problems[`${key}.code`] = `템플릿 코드 ${code}이(가) 중복됩니다`;
    if (code) codes.add(code.toLowerCase());
    if (!name) problems[`${key}.name`] = "템플릿 이름을 입력하세요";
    else if (name.length > 100) problems[`${key}.name`] = "템플릿 이름은 최대 100자입니다";
  });
  const numbers = new Set<string>();
  form.senders.forEach((s, i) => {
    const number = s.trim();
    const key = `senders.${i}`;
    if (!number) problems[key] = "발신번호를 입력하세요";
    else if (!SENDER.test(number)) problems[key] = SENDER_FORMAT_MESSAGE;
    else if (numbers.has(number)) problems[key] = `발신번호 ${number}이(가) 중복됩니다`;
    if (number) numbers.add(number);
  });
  if (form.templates.length > MAX_TEMPLATES) problems.templates = `템플릿은 최대 ${MAX_TEMPLATES}개입니다`;
  if (form.senders.length > MAX_SENDERS) problems.senders = `발신번호는 최대 ${MAX_SENDERS}개입니다`;
  return problems;
}

/** First problem in display order (templates, then senders). */
export function firstProblem(problems: Record<string, string>): string | null {
  return Object.values(problems)[0] ?? null;
}

export function normalizeSending(form: SendingForm): SendingForm {
  return {
    templates: form.templates.map((t) => ({ code: t.code.trim(), name: t.name.trim() })),
    senders: form.senders.map((s) => s.trim()),
  };
}

export function sameTemplates(a: ProjectTemplate[], b: ProjectTemplate[]): boolean {
  return a.length === b.length && a.every((t, i) => t.code === b[i].code && t.name === b[i].name);
}

export function sameSenders(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

export const SENDING_SAVED_TOAST = "발신 정보를 저장했습니다";
