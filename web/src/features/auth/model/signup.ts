import * as z from "zod/mini";
import type { SignupBody, SignupCustomer, SignupRole } from "@/entities/me";
import { PASSWORD_POLICY_ERROR, passwordMeetsPolicy } from "./schemas";

/** What a role needs besides the account: a project, only a customer, or nothing (platform role). */
export type SignupScope = "project" | "customer" | "none";

export interface SignupRoleDef {
  role: SignupRole;
  label: string;
  /** One line on what the role does in the flow. */
  summary: string;
  scope: SignupScope;
}

/** Roles in flow order: the project roles first, then the administration roles. */
export const SIGNUP_ROLES: readonly SignupRoleDef[] = [
  { role: "REQUESTER", label: "요청자", summary: "문안을 작성해 검수를 요청하고, 확인 요청에 답합니다", scope: "project" },
  {
    role: "LEAD_REVIEWER",
    label: "대표 검수자",
    summary: "들어온 요청에 검수자와 주담당을 배정하고 확정 납기를 정합니다",
    scope: "project",
  },
  {
    role: "REVIEWER",
    label: "검수자",
    summary: "배정된 요청을 검수합니다. 주담당이면 검수 완료를 처리합니다",
    scope: "project",
  },
  {
    role: "APPROVER",
    label: "승인자",
    summary: "검수가 끝난 요청을 승인하거나 수정 요청합니다 (승인 단계를 쓰는 고객사)",
    scope: "project",
  },
  {
    role: "CUSTOMER_ADMIN",
    label: "고객사 관리자",
    summary: "프로젝트, 사용자와 역할, 변수, 공지, 고객사 설정을 관리합니다",
    scope: "customer",
  },
  {
    role: "OPERATOR",
    label: "솔루션 운영 담당자",
    summary: "고객사를 만들고 초기 설정, 콘텐츠 유형, 교정 데이터셋을 운영합니다",
    scope: "none",
  },
];

export function signupRoleDef(role: SignupRole): SignupRoleDef {
  return SIGNUP_ROLES.find((r) => r.role === role) ?? SIGNUP_ROLES[0];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Form values. Keys = `POST /api/auth/signup` body keys; the selects hold ids as strings ("" = none chosen).
 * Customer/project/approval rules depend on the options and are checked by `signupProblem`.
 */
export const signupSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "이름을(를) 입력하세요"), z.maxLength(100, "이름은 최대 100자입니다")),
  email: z.string().check(
    z.trim(),
    z.minLength(1, "이메일을(를) 입력하세요"),
    z.maxLength(255, "이메일 형식을 확인하세요"),
    z.regex(EMAIL, "이메일 형식을 확인하세요"),
  ),
  password: z.string().check(z.refine(passwordMeetsPolicy, PASSWORD_POLICY_ERROR)),
  role: z.string().check(z.minLength(1, "역할을 선택하세요")),
  customerId: z.string(),
  projectId: z.string(),
});
export type SignupValues = z.infer<typeof signupSchema>;

export const EMPTY_SIGNUP: SignupValues = {
  name: "",
  email: "",
  password: "",
  role: "",
  customerId: "",
  projectId: "",
};

export type SignupField = "customerId" | "projectId" | "role";

/** Server order after the account fields: customer → project → approval. The first problem, or null. */
export function signupProblem(
  values: Pick<SignupValues, "role" | "customerId" | "projectId">,
  customers: SignupCustomer[],
): { field: SignupField; message: string } | null {
  if (!values.role) return { field: "role", message: "역할을 선택하세요" };
  const scope = signupRoleDef(values.role as SignupRole).scope;
  if (scope === "none") return null;
  const customer = customers.find((c) => String(c.id) === values.customerId);
  if (!customer) return { field: "customerId", message: "고객사를 선택하세요" };
  if (scope === "customer") return null;
  if (!customer.projects.some((p) => String(p.id) === values.projectId)) {
    return { field: "projectId", message: "프로젝트를 선택하세요" };
  }
  if (values.role === "APPROVER" && !customer.approvalEnabled) {
    return { field: "role", message: "이 고객사는 승인 단계를 쓰지 않습니다" };
  }
  return null;
}

/** Request body: trimmed text, lower-case email, ids only where the role uses them. */
export function signupBody(values: SignupValues): SignupBody {
  const role = values.role as SignupRole;
  const scope = signupRoleDef(role).scope;
  return {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    role,
    customerId: scope === "none" || !values.customerId ? null : Number(values.customerId),
    projectId: scope === "project" && values.projectId ? Number(values.projectId) : null,
  };
}
