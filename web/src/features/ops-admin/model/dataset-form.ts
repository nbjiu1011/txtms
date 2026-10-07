import type { DatasetRule } from "@/entities/ops";

/** XLSX header of the 7-column dataset template (contract §12). */
export const DATASET_COLUMNS = [
  "rule_id",
  "original_expr",
  "recommended_expr",
  "original_pattern",
  "recommended_pattern",
  "description_label",
  "description",
] as const;

export const RULES_JSON_PLACEHOLDER =
  '[{"ruleId":"R1","originalExpr":"되요","recommendedExpr":"돼요","descriptionLabel":"맞춤법","description":"되어요의 준말은 돼요입니다"}]';

const KEYS: (keyof DatasetRule)[] = [
  "ruleId",
  "originalExpr",
  "recommendedExpr",
  "originalPattern",
  "recommendedPattern",
  "descriptionLabel",
  "description",
];

/** Snake-case XLSX header names are accepted in JSON too (`rule_id` → `ruleId`). */
const SNAKE = new Map<string, keyof DatasetRule>(DATASET_COLUMNS.map((column, i) => [column, KEYS[i]]));

/**
 * Parses the pasted JSON rule array. The rows themselves are checked by the server (it answers
 * `{행}행: …` details); here only the shape: an array of objects with string values.
 */
export function parseRulesJson(text: string): { rules: Partial<DatasetRule>[] } | { error: string } {
  if (!text.trim()) return { error: "규칙 JSON 배열을(를) 입력하세요" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: `JSON 형식을 확인하세요 (${e instanceof Error ? e.message : String(e)})` };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: "규칙 배열을 입력하세요" };
  const rules: Partial<DatasetRule>[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { error: "규칙은 객체로 입력하세요" };
    const rule: Partial<DatasetRule> = {};
    for (const [rawKey, value] of Object.entries(item as Record<string, unknown>)) {
      const key = (KEYS as string[]).includes(rawKey) ? (rawKey as keyof DatasetRule) : SNAKE.get(rawKey);
      if (!key) continue;
      if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number") {
        return { error: `${rawKey} 값은 문자열로 입력하세요` };
      }
      rule[key] = value === null || value === undefined ? "" : String(value);
    }
    rules.push(rule);
  }
  return { rules };
}

export const XLSX_MAX_BYTES = 10 * 1024 * 1024;

/** Client check of the chosen workbook before upload (the server re-checks size and format). */
export function xlsxFileProblem(file: File | null): string | null {
  if (!file) return "파일을 선택하세요";
  if (!/\.xlsx$/i.test(file.name)) return "XLSX 파일만 등록할 수 있습니다";
  if (file.size > XLSX_MAX_BYTES) return "XLSX 최대 10MB";
  return null;
}
