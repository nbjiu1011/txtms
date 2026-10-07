import { describe, expect, it } from "vitest";
import { request103U4 } from "@fixtures/api-snapshot";
import { hasActiveApprover, toApprovalQueueRow } from "./approval-rows";

describe("approval screen rows", () => {
  it("승인 대기 row: round, contents with versions, due date and 처리 가능", () => {
    const r = { ...request103U4, contentCount: 2, contentVersions: [2, 1], round: 2, dueDate: "2026-10-08", approvable: true };
    expect(toApprovalQueueRow(r)).toEqual({
      id: r.id,
      title: r.title,
      round: "2차",
      primaryReviewerId: r.primaryReviewerId,
      contents: "2건 v2 v1",
      due: "10월 8일",
      canProcess: true,
    });
    expect(toApprovalQueueRow({ ...r, approvable: false }).canProcess).toBe(false);
  });

  it("no-approver banner: only active members with the APPROVER role count", () => {
    const members = [
      { userId: 1, roles: ["REQUESTER"] },
      { userId: 4, roles: ["APPROVER"] },
    ];
    expect(hasActiveApprover(members, () => true)).toBe(true);
    expect(hasActiveApprover(members, (id) => id !== 4)).toBe(false);
    expect(hasActiveApprover([{ userId: 1, roles: ["REQUESTER"] }], () => true)).toBe(false);
  });
});
