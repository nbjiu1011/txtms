import { describe, expect, it } from "vitest";
import { buildTrack, trackStages } from "./track";
import type { StageTimes } from "./types";

const times: StageTimes = {
  DRAFT: "2026-10-04T00:00:00Z",
  WAITING: "2026-10-04T01:00:00Z",
  IN_REVIEW: "2026-10-04T02:00:00Z",
  COMPLETED: null,
  APPROVED: null,
};

describe("trackStages", () => {
  it("ends with 승인 대기 → 승인 완료 when approval is used, else 검수 완료", () => {
    expect(trackStages(true)).toEqual(["DRAFT", "WAITING", "IN_REVIEW", "APPROVAL_WAITING", "APPROVED"]);
    expect(trackStages(false)).toEqual(["DRAFT", "WAITING", "IN_REVIEW", "REVIEW_COMPLETED"]);
  });
});

describe("buildTrack", () => {
  it("marks past/current/future and shows times up to the current step", () => {
    const steps = buildTrack({ status: "IN_REVIEW", approvalEnabled: true, stageTimes: times, askCount: 0 });
    expect(steps.map((s) => s.state)).toEqual(["past", "past", "current", "future", "future"]);
    expect(steps.map((s) => s.label)).toEqual(["작성 중", "배정 대기", "검수 중", "승인 대기", "승인 완료"]);
    expect(steps[2]).toMatchObject({ tone: "review", reachedAt: times.IN_REVIEW, loop: null });
    expect(steps[3].reachedAt).toBeNull();
  });

  it("puts 확인 요청 on the review step with the ask tone and loop count", () => {
    const steps = buildTrack({ status: "CONFIRMING", approvalEnabled: true, stageTimes: times, askCount: 2 });
    expect(steps[2]).toMatchObject({ state: "current", label: "확인 요청 중", tone: "ask", loop: "확인 요청 2회" });
  });

  it("keeps the loop count on the review step after it passed", () => {
    const steps = buildTrack({
      status: "APPROVAL_WAITING",
      approvalEnabled: true,
      stageTimes: { ...times, COMPLETED: "2026-10-05T00:00:00Z" },
      askCount: 1,
    });
    expect(steps[2]).toMatchObject({ state: "past", label: "검수 중", loop: "확인 요청 1회" });
    expect(steps[3]).toMatchObject({ state: "current", tone: "appr", reachedAt: "2026-10-05T00:00:00Z" });
  });

  it("uses the completed time for 검수 완료 without approval", () => {
    const steps = buildTrack({
      status: "REVIEW_COMPLETED",
      approvalEnabled: false,
      stageTimes: { ...times, COMPLETED: "2026-10-06T00:00:00Z" },
      askCount: 0,
    });
    expect(steps).toHaveLength(4);
    expect(steps[3]).toMatchObject({
      state: "current",
      label: "검수 완료",
      tone: "done",
      reachedAt: "2026-10-06T00:00:00Z",
    });
  });

  it("starts at the first step for a draft", () => {
    const steps = buildTrack({ status: "DRAFT", approvalEnabled: false, stageTimes: times, askCount: 0 });
    expect(steps.map((s) => s.state)).toEqual(["current", "future", "future", "future"]);
    expect(steps[1].reachedAt).toBeNull();
  });
});
