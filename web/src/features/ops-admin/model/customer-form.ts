import { firstMissing } from "@/shared/lib";
import type { CustomerCreate, OpsCustomer } from "@/entities/ops";

export interface CustomerForm {
  name: string;
  domain: string;
  approvalEnabled: boolean;
}

export const EMPTY_CUSTOMER_FORM: CustomerForm = { name: "", domain: "", approvalEnabled: false };

/**
 * Same normalisation as the server: the host name is taken from whatever was pasted
 * (`admin@Tago.co.kr`, `https://www.tago.co.kr:8080/x`, `tago.co.kr.` → `tago.co.kr`) and a Korean
 * domain becomes punycode (`예시.com` → `xn--vv4b11d.com`).
 */
export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const at = value.lastIndexOf("@");
  if (at >= 0) value = value.slice(at + 1);
  value = value.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.+$/, "");
  if (value.startsWith("www.")) value = value.slice(4);
  if (!value) return "";
  if (/[^\x00-\x7f]/.test(value)) {
    try {
      value = new URL(`http://${value}`).hostname;
    } catch {
      return value;
    }
  }
  return value;
}

const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Host name check of the API: letters/digits/inner hyphens per label, final label ≥ 2 letters, ≤ 253. */
export function isDomainFormat(domain: string): boolean {
  return domain.length <= 253 && DOMAIN.test(domain);
}

/**
 * Text under the domain field: the value that will be stored when it differs from the input
 * (`@Example.CO.KR ` → `example.co.kr`), else null.
 */
export function domainPreview(raw: string): string | null {
  const normalized = normalizeDomain(raw);
  if (!normalized || normalized === raw) return null;
  return `저장 값: ${normalized}`;
}

export const DOMAIN_FORMAT_MESSAGE = "도메인 형식을 확인하세요";

export function duplicateDomainMessage(existingName: string): string {
  return `${existingName}이(가) 같은 도메인을 쓰고 있습니다`;
}

/** Reference `opsCustNew` checks in order; the first problem with its contract field. */
export function customerFormProblem(
  form: CustomerForm,
  customers: Pick<OpsCustomer, "name" | "domain">[],
): { message: string; field: "name" | "domain" } | null {
  const missingName = firstMissing([[form.name, "고객사 이름"]]);
  if (missingName) return { message: missingName, field: "name" };
  if (form.name.trim().length > 100) return { message: "고객사 이름은 최대 100자입니다", field: "name" };
  const domain = normalizeDomain(form.domain);
  if (!domain) return { message: "회사 도메인을(를) 입력하세요", field: "domain" };
  if (!isDomainFormat(domain)) return { message: DOMAIN_FORMAT_MESSAGE, field: "domain" };
  const duplicate = customers.find((c) => c.domain.toLowerCase() === domain);
  if (duplicate) return { message: duplicateDomainMessage(duplicate.name), field: "domain" };
  return null;
}

export function customerBody(form: CustomerForm): CustomerCreate {
  return { name: form.name.trim(), domain: normalizeDomain(form.domain), approvalEnabled: form.approvalEnabled };
}

export const CUSTOMER_CREATED_TOAST = "고객사를 만들었습니다. 초기 설정을 이어서 진행하세요";

/** Deactivation checks (reason first, then requests in progress — the server re-checks both). */
export function deactivateProblem(reason: string, activeRequestCount: number): string | null {
  const missing = firstMissing([[reason, "비활성 사유"]]);
  if (missing) return missing;
  if (reason.trim().length > 500) return "비활성 사유는 최대 500자입니다";
  if (activeRequestCount > 0) {
    return `진행 중 요청 ${activeRequestCount}건을 먼저 정리하거나 담당자와 합의해야 합니다`;
  }
  return null;
}
