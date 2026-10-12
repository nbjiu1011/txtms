import { describe, expect, it } from "vitest";
import type { SignupCustomer } from "@/entities/me";
import { EMPTY_SIGNUP, SIGNUP_ROLES, signupBody, signupProblem, signupSchema } from "./signup";

const customers: SignupCustomer[] = [
  { id: 1, name: "한빛카드", approvalEnabled: true, projects: [{ id: 10, name: "카드 혜택 알림", leadName: "박지훈" }] },
  { id: 2, name: "도담생명", approvalEnabled: false, projects: [{ id: 20, name: "계약 유지 안내", leadName: null }] },
];

describe("temporary sign-up rules (same order as the API)", () => {
  it("lists every role once, project roles first", () => {
    expect(SIGNUP_ROLES.map((r) => r.role)).toEqual([
      "REQUESTER",
      "LEAD_REVIEWER",
      "REVIEWER",
      "APPROVER",
      "CUSTOMER_ADMIN",
      "OPERATOR",
    ]);
  });

  it("checks role, customer, project, then approval", () => {
    const v = { role: "", customerId: "", projectId: "" };
    expect(signupProblem(v, customers)).toEqual({ field: "role", message: "역할을 선택하세요" });
    expect(signupProblem({ ...v, role: "REVIEWER" }, customers)).toEqual({
      field: "customerId",
      message: "고객사를 선택하세요",
    });
    expect(signupProblem({ ...v, role: "REVIEWER", customerId: "1" }, customers)).toEqual({
      field: "projectId",
      message: "프로젝트를 선택하세요",
    });
    // a project of another customer is not a choice
    expect(signupProblem({ role: "REVIEWER", customerId: "1", projectId: "20" }, customers)?.field).toBe("projectId");
    expect(signupProblem({ role: "APPROVER", customerId: "2", projectId: "20" }, customers)).toEqual({
      field: "role",
      message: "이 고객사는 승인 단계를 쓰지 않습니다",
    });
    expect(signupProblem({ role: "APPROVER", customerId: "1", projectId: "10" }, customers)).toBeNull();
  });

  it("needs only a customer for the admin and nothing for the operator", () => {
    expect(signupProblem({ role: "CUSTOMER_ADMIN", customerId: "", projectId: "" }, customers)?.field).toBe(
      "customerId",
    );
    expect(signupProblem({ role: "CUSTOMER_ADMIN", customerId: "2", projectId: "" }, customers)).toBeNull();
    expect(signupProblem({ role: "OPERATOR", customerId: "", projectId: "" }, customers)).toBeNull();
  });

  it("sends ids only where the role uses them", () => {
    const base = { ...EMPTY_SIGNUP, name: " 홍길동 ", email: " Gil@Example.COM ", password: "Signup!2026" };
    expect(signupBody({ ...base, role: "REVIEWER", customerId: "1", projectId: "10" })).toEqual({
      name: "홍길동",
      email: "gil@example.com",
      password: "Signup!2026",
      role: "REVIEWER",
      customerId: 1,
      projectId: 10,
    });
    expect(signupBody({ ...base, role: "CUSTOMER_ADMIN", customerId: "2", projectId: "20" })).toMatchObject({
      customerId: 2,
      projectId: null,
    });
    expect(signupBody({ ...base, role: "OPERATOR", customerId: "2", projectId: "20" })).toMatchObject({
      customerId: null,
      projectId: null,
    });
  });

  it("validates the account fields with the server wording", () => {
    const result = signupSchema.safeParse({ ...EMPTY_SIGNUP, email: "x", password: "short" });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual([
      "이름을(를) 입력하세요",
      "이메일 형식을 확인하세요",
      "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다",
      "역할을 선택하세요",
    ]);
  });
});
