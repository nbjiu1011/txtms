import { describe, expect, it } from "vitest";
import type { RequestSummary } from "@/entities/request";
import { request101U2, request107U2 } from "@fixtures/api-snapshot";
import { reviewSubTabs, toAssignQueueRow, toMyReviewRow } from "./review-rows";

const summary = (over: Partial<RequestSummary>): RequestSummary => ({ ...request101U2, ...over });

describe("review screen rows", () => {
  it("sub tabs follow the roles (reviewer: 내 검수, lead: 배정 관리)", () => {
    expect(reviewSubTabs({ reviewer: true, lead: false })).toEqual(["mine"]);
    expect(reviewSubTabs({ reviewer: false, lead: true })).toEqual(["assign"]);
    expect(reviewSubTabs({ reviewer: true, lead: true })).toEqual(["mine", "assign"]);
    expect(reviewSubTabs({ reviewer: false, lead: false })).toEqual([]);
  });

  it("내 검수: primary vs co-reviewer role, volume and due tags", () => {
    const r = summary({
      id: "REQ-1",
      primaryReviewerId: 2,
      reviewerIds: [2, 6],
      round: 2,
      dueDate: "2026-10-09",
      overdue: true,
      dueSoon: true,
      volume: { chars: 1240, files: [{ unit: "PAGE", amount: 6 }] },
    });
    expect(toMyReviewRow(r, 2)).toMatchObject({
      id: "REQ-1",
      role: "주담당",
      round: "2차",
      volume: "1,240자, 페이지 6",
      due: "10월 9일",
      dueTag: "지연",
    });
    expect(toMyReviewRow(r, 6).role).toBe("공동 검수");
    expect(toMyReviewRow({ ...r, overdue: false }, 6).dueTag).toBe("임박");
    expect(toMyReviewRow({ ...r, overdue: false, dueSoon: false }, 6).dueTag).toBeNull();
  });

  it("marks a pending recall and names untitled requests", () => {
    expect(toMyReviewRow(request107U2, 2).recall).toBe(true);
    expect(toMyReviewRow(summary({ title: "" }), 2).title).toBe("제목 없는 요청");
  });

  it("배정 관리 row: id, hope and due dates, urgency, untitled name", () => {
    const r = summary({ id: "REQ-9", title: "", hopeDueDate: "2026-10-10", dueDate: null, urgency: "URGENT" });
    expect(toAssignQueueRow(r)).toMatchObject({
      id: "REQ-9",
      title: "제목 없는 요청",
      hope: "10월 10일",
      due: "-",
      urgency: "긴급",
    });
  });
});
