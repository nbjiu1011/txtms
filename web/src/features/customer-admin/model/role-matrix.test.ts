import { describe, expect, it } from "vitest";
import { changedProjects, initialRoleMatrix, roleCells, roleMatrixProblem, toggleRole } from "./role-matrix";

describe("role editor rules (reference roleEdit)", () => {
  it("requester and reviewer exclude each other", () => {
    const withReviewer = roleCells(["REVIEWER"], false, true);
    expect(withReviewer.REQUESTER).toEqual({ checked: false, disabled: true, title: "검수자 역할과 함께 줄 수 없습니다" });
    expect(withReviewer.REVIEWER.disabled).toBe(false);
    const withRequester = roleCells(["REQUESTER"], false, true);
    expect(withRequester.REVIEWER.disabled).toBe(true);
    expect(withRequester.REQUESTER.disabled).toBe(false);
  });

  it("the lead's reviewer box is locked; approver needs an approval customer", () => {
    expect(roleCells(["REVIEWER"], true, true).REVIEWER).toEqual({ checked: true, disabled: true });
    expect(roleCells([], false, false).APPROVER).toEqual({ checked: false, disabled: true, title: "승인 단계 미사용" });
    expect(roleCells([], false, true).APPROVER.disabled).toBe(false);
  });

  it("keeps roles in contract order and sends only changed projects", () => {
    expect(toggleRole(["APPROVER"], "REQUESTER", true)).toEqual(["REQUESTER", "APPROVER"]);
    const memberships = [{ projectId: 1, roles: ["REVIEWER" as const], lead: false }];
    const matrix = initialRoleMatrix([{ id: 1 }, { id: 2 }], memberships);
    expect(matrix).toEqual({ 1: ["REVIEWER"], 2: [] });
    expect(changedProjects(matrix, memberships)).toEqual([]);
    expect(changedProjects({ 1: [], 2: ["REQUESTER"] }, memberships)).toEqual([
      { projectId: 1, roles: [] },
      { projectId: 2, roles: ["REQUESTER"] },
    ]);
    expect(roleMatrixProblem({ 1: ["REQUESTER", "REVIEWER"] })).toBe("요청자와 검수자는 함께 줄 수 없습니다");
  });
});
