import { describe, expect, it } from "vitest";
import type { Content } from "@/entities/request";
import { request101U2 } from "@fixtures/api-snapshot";
import {
  LOCKED_BEFORE_COMPLETE,
  UNSAVED_REVISION_BEFORE_COMPLETE,
  checkBeforeComplete,
  coReviewerOpinions,
  coReviewerRole,
} from "./complete-check";

const lockedBy = (userId: number): Content[] =>
  request101U2.contents.map((c, i) => (i === 0 ? { ...c, lock: { userId, lockedAt: "", expiresAt: "" } } : c));

describe("checkBeforeComplete", () => {
  const ctx = { meId: 2, approvalEnabled: true, hasUnsavedRevision: false };

  it("no eligible approver goes to the server first (it records the block)", () => {
    expect(checkBeforeComplete({ ...request101U2, eligibleApproverIds: [] }, ctx)).toEqual({ kind: "noApprover" });
    expect(
      checkBeforeComplete({ ...request101U2, eligibleApproverIds: [] }, { ...ctx, approvalEnabled: false }),
    ).toEqual({ kind: "confirm" });
  });

  it("another reviewer's lock, then my unsaved revision block the confirmation", () => {
    const r = { ...request101U2, eligibleApproverIds: [4] };
    expect(checkBeforeComplete({ ...r, contents: lockedBy(6) }, { ...ctx, hasUnsavedRevision: true })).toEqual({
      kind: "blocked",
      message: LOCKED_BEFORE_COMPLETE,
    });
    expect(checkBeforeComplete({ ...r, contents: lockedBy(2) }, { ...ctx, hasUnsavedRevision: true })).toEqual({
      kind: "blocked",
      message: UNSAVED_REVISION_BEFORE_COMPLETE,
    });
    expect(checkBeforeComplete(r, ctx)).toEqual({ kind: "confirm" });
  });
});

describe("공동 검수 결과 labels", () => {
  it("primary, current co-reviewer and earlier assignee", () => {
    expect(coReviewerRole({ primary: true, current: true })).toBe("(주담당)");
    expect(coReviewerRole({ primary: false, current: true })).toBe("");
    expect(coReviewerRole({ primary: false, current: false })).toBe("(이전 담당)");
  });

  it("opinion counts, split by round when they span several", () => {
    expect(coReviewerOpinions({ opinionCount: 0, rounds: [] })).toBe("검수 의견 0건");
    expect(coReviewerOpinions({ opinionCount: 2, rounds: [{ round: 1, count: 2 }] })).toBe("검수 의견 2건");
    expect(
      coReviewerOpinions({
        opinionCount: 3,
        rounds: [
          { round: 1, count: 2 },
          { round: 2, count: 1 },
        ],
      }),
    ).toBe("검수 의견 3건 · 1차 2건, 2차 1건");
  });
});
