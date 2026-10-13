import { describe, expect, it } from "vitest";
import {
  addMemberRow,
  initialMemberRows,
  memberRowsChanged,
  memberRowsProblem,
  removeMemberRow,
} from "./project-members";

const project = {
  leadUserId: 3,
  members: [
    { userId: 1, roles: ["REQUESTER" as const] },
    { userId: 3, roles: ["REVIEWER" as const] },
  ],
};

describe("project members", () => {
  it("starts from the members with the lead first; add and remove rows", () => {
    const rows = initialMemberRows(project);
    expect(rows.map((r) => r.userId)).toEqual([3, 1]);
    const added = addMemberRow(rows, 7);
    expect(added.at(-1)).toEqual({ userId: 7, roles: [] });
    expect(addMemberRow(added, 7)).toBe(added);
    expect(removeMemberRow(added, 1).map((r) => r.userId)).toEqual([3, 7]);
  });

  it("checks exclusivity, rows without roles and approvers", () => {
    const rows = initialMemberRows(project);
    expect(memberRowsProblem(rows, false)).toBeNull();
    expect(memberRowsProblem([...rows, { userId: 7, roles: [] }], false)).toBe(
      "추가한 구성원의 역할을 하나 이상 선택하세요",
    );
    expect(memberRowsProblem([{ userId: 1, roles: ["REQUESTER", "REVIEWER"] }], false)).toBe(
      "요청자와 검수자는 함께 줄 수 없습니다",
    );
    expect(memberRowsProblem(rows, true)).toBe("승인자를 한 명 이상 지정하세요");
    expect(memberRowsProblem([...rows, { userId: 7, roles: ["APPROVER"] }], true)).toBeNull();
  });

  it("ignores order when telling whether anything changed", () => {
    const rows = initialMemberRows(project);
    expect(memberRowsChanged(rows, project)).toBe(false);
    expect(memberRowsChanged(removeMemberRow(rows, 1), project)).toBe(true);
    expect(memberRowsChanged([{ userId: 1, roles: ["REQUESTER", "APPROVER"] }, rows[0]], project)).toBe(true);
  });
});
