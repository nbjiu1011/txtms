import type { ProjectTemplate } from "@/entities/project";

/** Editable rows of the 알림톡 템플릿 editor (contract §12 `PUT /api/ops/projects/{id}/templates`). */
export interface TemplateForm {
  templates: ProjectTemplate[];
}

export const MAX_TEMPLATES = 100;
const CODE = /^[A-Za-z0-9_-]+$/;

/**
 * Same checks and messages as the API, keyed like its `fieldErrors` (`templates.{i}.code|name`) so
 * client and server refusals land under the same row. Values are trimmed.
 */
export function templateProblems(form: TemplateForm): Record<string, string> {
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
  if (form.templates.length > MAX_TEMPLATES) problems.templates = `템플릿은 최대 ${MAX_TEMPLATES}개입니다`;
  return problems;
}

/** First problem in display order (rows top to bottom). */
export function firstProblem(problems: Record<string, string>): string | null {
  return Object.values(problems)[0] ?? null;
}

export function normalizeTemplates(form: TemplateForm): TemplateForm {
  return { templates: form.templates.map((t) => ({ code: t.code.trim(), name: t.name.trim() })) };
}

export function sameTemplates(a: ProjectTemplate[], b: ProjectTemplate[]): boolean {
  return a.length === b.length && a.every((t, i) => t.code === b[i].code && t.name === b[i].name);
}

export const TEMPLATES_SAVED_TOAST = "알림톡 템플릿을 저장했습니다";
