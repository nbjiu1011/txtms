import { describe, expect, it } from "vitest";
import { changedProjects, initialRoleMatrix, roleCells, roleMatrixProblem, toggleRole } from "./role-matrix";

describe("role editor rules (reference roleEdit)", () => {
  it("requester and reviewer stay clickable and ticking one clears the other", () => {
    const withReviewer = roleCells(["REVIEWER"], false, true);
    expect(withReviewer.REQUESTER).toEqual({ checked: false, disabled: false, title: "선택하면 검수자 역할이 해제됩니다" });
    expect(withReviewer.REVIEWER.disabled).toBe(false);
    const withRequester = roleCells(["REQUESTER"], false, true);
    expect(withRequester.REVIEWER).toEqual({ checked: false, disabled: false, title: "선택하면 요청자 역할이 해제됩니다" });
    expect(withRequester.REQUESTER.disabled).toBe(false);

    expect(toggleRole(["REVIEWER", "APPROVER"], "REQUESTER", true)).toEqual(["REQUESTER", "APPROVER"]);
    expect(toggleRole(["REQUESTER"], "REVIEWER", true)).toEqual(["REVIEWER"]);
    // unticking clears only that role
    expect(toggleRole(["REQUESTER", "APPROVER"], "REQUESTER", false)).toEqual(["APPROVER"]);
    // the approver role is independent of the pair
    expect(toggleRole(["REVIEWER"], "APPROVER", true)).toEqual(["REVIEWER", "APPROVER"]);
  });

  it("the lead's reviewer and requester boxes are locked; approver needs an approval customer", () => {
    const lead = roleCells(["REVIEWER"], true, true);
    expect(lead.REVIEWER).toEqual({ checked: true, disabled: true, title: "대표 검수자는 프로젝트 수정에서 바꾸세요" });
    expect(lead.REQUESTER).toEqual({
      checked: false,
      disabled: true,
      title: "대표 검수자는 요청자 역할을 함께 가질 수 없습니다",
    });
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
