import { describe, expect, it } from "vitest";
import type { Project } from "@/entities/project";
import type { DeactivationImpact, Member } from "@/entities/user";
import type { Variable } from "@/entities/variable";
import { blockingItems, deactivationProblem, needsSubstitute, preBlocked } from "./deactivation";
import { inviteStep, type InviteForm } from "./invite-form";
import { noticeBody, noticeFormProblem } from "./notice-form";
import { projectFormProblem, type ProjectForm } from "./project-form";
import { inlineError } from "@/shared/ui";
import { variableFormProblem, variablePatch, variableUsageText } from "./variable-form";

const invite: InviteForm = { email: "Kim@Partner.com", name: "김초대", projectId: "1", role: "REVIEWER" };

describe("invite step (external domain confirmation, J:289)", () => {
  it("holds an external address once, then sends it as confirmed", () => {
    expect(inviteStep(invite, "hanbitcard.co.kr", "")).toEqual({
      kind: "ask",
      confirmedEmail: "kim@partner.com",
      message: "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다",
    });
    expect(inviteStep(invite, "hanbitcard.co.kr", "kim@partner.com")).toMatchObject({
      kind: "send",
      body: { email: "kim@partner.com", externalDomainConfirmed: true, projectId: 1, role: "REVIEWER" },
    });
  });

  it("asks again when the email changed; company addresses need no confirmation", () => {
    expect(inviteStep({ ...invite, email: "lee@partner.com" }, "hanbitcard.co.kr", "kim@partner.com").kind).toBe("ask");
    expect(inviteStep({ ...invite, email: "a@hanbitcard.co.kr" }, "hanbitcard.co.kr", "")).toMatchObject({
      kind: "send",
      body: { externalDomainConfirmed: false },
    });
  });

  it("checks required fields and the format in the reference order", () => {
    expect(inviteStep({ ...invite, email: "" }, "x.com", "")).toEqual({ kind: "invalid", message: "이메일을(를) 입력하세요" });
    expect(inviteStep({ ...invite, email: "a@x.com", name: " " }, "x.com", "")).toEqual({
      kind: "invalid",
      message: "이름을(를) 입력하세요",
    });
    expect(inviteStep({ ...invite, email: "a@b@x.com" }, "x.com", "a@b@x.com")).toEqual({
      kind: "invalid",
      message: "이메일 형식을 확인하세요",
    });
  });
});

describe("project form checks", () => {
  const project = { id: 1, members: [{ userId: 1, roles: ["REQUESTER"] }] } as unknown as Project;
  const form: ProjectForm = { name: "새 프로젝트", leadUserId: "3", approverIds: [4], active: true };
  it("requires name and lead, refuses a requester lead, needs approvers on approval customers", () => {
    expect(projectFormProblem({ ...form, name: "" }, null, true)).toBe("프로젝트 이름을(를) 입력하세요");
    expect(projectFormProblem({ ...form, leadUserId: "" }, null, true)).toBe("대표 검수자을(를) 입력하세요");
    expect(projectFormProblem({ ...form, leadUserId: "1" }, project, true)).toBe(
      "요청자 역할을 가진 사용자는 대표 검수자가 될 수 없습니다",
    );
    expect(projectFormProblem({ ...form, approverIds: [] }, null, true)).toBe("승인자를 한 명 이상 지정하세요");
    expect(projectFormProblem({ ...form, approverIds: [] }, null, false)).toBeNull();
  });
});

describe("variable admin", () => {
  const v: Variable = {
    id: 1,
    projectId: 1,
    key: "customer_name",
    description: "고객명",
    type: "TEXT",
    value: "홍길동",
    active: true,
    inUse: true,
    deleted: false,
    createdBy: 1,
    createdAt: "",
    updatedAt: "",
  };
  it("shows usage and protects keys in use", () => {
    expect(variableUsageText(v)).toBe("활성 · 사용 중");
    expect(variableUsageText({ active: false, inUse: false, deleted: false })).toBe("중지");
    expect(variableUsageText({ active: false, inUse: false, deleted: true })).toBe("삭제");
    expect(variableFormProblem({ ...v, key: "renamed" }, v)).toBe("사용 중인 변수는 키를 변경할 수 없습니다");
    expect(variableFormProblem({ ...v, key: "Bad-Key" }, null)).toBe("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
    expect(variableFormProblem({ ...v, type: "NUMBER", value: "abc" }, null)).toBe("정수 또는 소수를 입력하세요");
    expect(variableFormProblem({ ...v, type: "DATE", value: "2026-02-30" }, null)).toBe(
      "유효한 YYYY-MM-DD 날짜를 입력하세요",
    );
    expect(variableFormProblem({ ...v, type: "LINK", value: "ftp://x" }, null)).toBe("HTTP/HTTPS 링크를 입력하세요");
    expect(variablePatch({ ...v, value: "김철수", active: false }, v)).toEqual({ value: "김철수", active: false });
  });
});

describe("notice form", () => {
  it("requires title and body; customer scope drops the project", () => {
    expect(noticeFormProblem({ scope: "PROJECT", projectId: "1", title: "", body: "x" })).toBe("제목을(를) 입력하세요");
    expect(noticeFormProblem({ scope: "PROJECT", projectId: "1", title: "t", body: "" })).toBe("내용을(를) 입력하세요");
    expect(noticeFormProblem({ scope: "PROJECT", projectId: "1", title: "t", body: "<p><br></p>" })).toBe("내용을(를) 입력하세요");
    expect(noticeFormProblem({ scope: "PROJECT", projectId: "1", title: "t", body: "<p>안내</p>" })).toBeNull();
    expect(noticeBody({ scope: "CUSTOMER", projectId: "1", title: " t ", body: "b" })).toEqual({
      scope: "CUSTOMER",
      projectId: null,
      title: "t",
      body: "b",
    });
  });
});

describe("deactivation rules", () => {
  const req = (id: string, status: string, requesterId = 1, projectId = 1) =>
    ({ id, status, requesterId, projectId }) as unknown as DeactivationImpact["reviewing"][number];
  const impact = (patch: Partial<DeactivationImpact> = {}): DeactivationImpact => ({
    reviewing: [],
    requesting: [],
    leadProjects: [],
    lastApproverProjects: [],
    substitutes: [],
    lastAdmin: false,
    ...patch,
  });
  const member = (id: number, roles: string[], patch: Partial<Member> = {}): Member =>
    ({
      user: { id, name: `U${id}`, dept: "", email: "", active: true, avatarColor: "" },
      pending: false,
      admin: false,
      projects: [{ projectId: 1, roles, lead: false }],
      invitationExpiresAt: null,
      ...patch,
    }) as Member;

  it("refuses before the modal while a review waits for an answer or approval", () => {
    expect(preBlocked(impact({ reviewing: [req("R1", "CONFIRMING")] }))).toBe(true);
    expect(preBlocked(impact({ reviewing: [req("R1", "IN_REVIEW")] }))).toBe(false);
  });

  it("needs a substitute only for handed-over reviews or lead projects", () => {
    expect(needsSubstitute(impact())).toBe(false);
    expect(needsSubstitute(impact({ reviewing: [req("R1", "IN_REVIEW")] }))).toBe(true);
    const i = impact({ reviewing: [req("R1", "IN_REVIEW", 7)] });
    expect(deactivationProblem(i, undefined, "")).toBe("대체자을(를) 입력하세요");
    expect(deactivationProblem(i, member(2, ["REVIEWER"]), " ")).toBe("인수인계 내용을(를) 입력하세요");
    expect(deactivationProblem(i, member(7, ["REVIEWER"]), "x")).toBe(
      "해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다",
    );
    expect(deactivationProblem(i, member(2, ["REVIEWER"]), "x")).toBeNull();
  });

  it("lists blockers and substitute candidates", () => {
    const i = impact({
      requesting: [req("R9", "WAITING")],
      lastApproverProjects: [{ name: "카드" } as Project],
      lastAdmin: true,
    });
    expect(blockingItems(i)).toEqual([
      { label: "요청자로 진행 중", value: "R9" },
      { label: "마지막 승인자", value: "카드" },
      { label: "마지막 고객사 관리자", value: "예" },
    ]);
    expect(deactivationProblem(i, undefined, "")).toBe("마지막 승인자입니다. 새 승인자를 먼저 지정하세요");
  });
});

describe("server error display", () => {
  it("keeps a message under its field out of the modal-level box", () => {
    expect(inlineError({ code: "VALIDATION_FAILED", message: "m", fields: { name: "m" }, details: [] })).toEqual({
      message: "",
      items: [],
    });
    expect(
      inlineError({ code: "REQUEST_STATE_CONFLICT", message: "진행 중", fields: {}, details: ["REQ-1 카드"] }),
    ).toEqual({ message: "진행 중", items: ["REQ-1 카드"] });
  });
});
