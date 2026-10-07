import { describe, expect, it } from "vitest";
import type { RequestDetail } from "@/entities/request";
import { request088U1, request101U2, request102U1, request103U4, request107U2 } from "@fixtures/api-snapshot";
import { selectBanners, type BannerContext } from "./banners";

const NAMES: Record<number, string> = { 1: "김서연", 2: "박지훈", 3: "이도현", 4: "최민아", 6: "한가을" };
const ctx = (meId: number, meIsApprover = false): BannerContext => ({
  meId,
  meIsApprover,
  name: (id) => (id ? (NAMES[id] ?? "-") : "-"),
});
const keys = (r: RequestDetail, c: BannerContext) => selectBanners(r, c).map((b) => b.key);

describe("selectBanners", () => {
  it("draft of mine: 검수 요청 전입니다", () => {
    const r: RequestDetail = { ...request101U2, status: "DRAFT", requesterId: 1, reviewerIds: [], allowedActions: [] };
    expect(selectBanners(r, ctx(1))).toMatchObject([{ key: "draft", tone: "info", title: "검수 요청 전입니다" }]);
    expect(keys(r, ctx(2))).toEqual([]);
  });

  it("waiting: requester can cancel, others wait for the lead", () => {
    const r: RequestDetail = { ...request101U2, status: "WAITING", reviewerIds: [], primaryReviewerId: null };
    expect(selectBanners(r, ctx(1))[0].lines[0]).toBe("검수자가 배정되기 전에는 요청을 바로 취소할 수 있습니다.");
    expect(selectBanners(r, ctx(3))[0].lines[0]).toBe("대표 검수자가 검수자와 주담당을 지정하면 검수가 시작됩니다.");
  });

  it("확인 요청: the requester gets the answer button, reviewers a waiting note", () => {
    expect(selectBanners(request102U1, ctx(1))).toMatchObject([
      { key: "ask", tone: "ask", title: "검수자가 확인을 요청했습니다", action: "answer" },
    ]);
    expect(selectBanners(request102U1, ctx(3))).toMatchObject([
      { key: "ask", title: "요청자 답변을 기다리고 있습니다", action: null },
    ]);
  });

  it("recall: the primary reviewer decides (DECIDE_RECALL), others see who decides", () => {
    expect(request107U2.allowedActions).toContain("DECIDE_RECALL");
    const decide = selectBanners(request107U2, ctx(2));
    expect(decide).toHaveLength(1);
    expect(decide[0]).toMatchObject({ key: "recall", tone: "danger", title: "김서연님이 회수를 요청했습니다" });
    expect(decide[0].lines[0]).toBe(`사유: ${request107U2.recall?.reason}`);
    expect(decide[0].action).toBe("decideRecall");

    const viewer = selectBanners({ ...request107U2, allowedActions: [] }, ctx(1));
    expect(viewer).toMatchObject([{ key: "recall", title: "회수 요청 처리 중입니다" }]);
    expect(viewer[0].lines[0]).toContain("주담당 검수자 박지훈님");
  });

  it("in review: primary vs co-reviewer banners (none while a recall is pending)", () => {
    expect(selectBanners(request101U2, ctx(2))).toMatchObject([{ key: "review", title: "주담당 검수자입니다" }]);
    expect(selectBanners(request101U2, ctx(2))[0].lines[0]).toMatch(/^공동 검수 결과와 /);
    expect(selectBanners(request101U2, ctx(6))).toMatchObject([{ key: "review", title: "공동 검수 중입니다" }]);
    expect(selectBanners(request101U2, ctx(1))).toEqual([]);
    expect(keys(request107U2, ctx(3))).toEqual(["recall"]);
  });

  it("approval waiting: names eligible approvers; an ineligible approver gets the extra line", () => {
    const [banner] = selectBanners(request103U4, ctx(4, true));
    expect(banner).toMatchObject({ key: "appr", tone: "appr", title: "최종 승인을 기다리고 있습니다" });
    expect(banner.lines).toHaveLength(1);
    expect(banner.lines[0]).toContain("프로젝트 승인자 최민아 중 한 명이 처리합니다.");

    const ineligible = selectBanners({ ...request103U4, allowedActions: [] }, ctx(4, true))[0];
    expect(ineligible.lines[1]).toBe("본인이 요청자이거나 배정 검수자인 요청은 승인할 수 없습니다.");
    expect(selectBanners({ ...request103U4, allowedActions: [] }, ctx(1, false))[0].lines).toHaveLength(1);
  });

  it("final: done banner with the bundle time and the result button", () => {
    const [banner] = selectBanners(request088U1, ctx(1));
    expect(banner).toMatchObject({ key: "final", tone: "done", title: "승인 완료된 요청입니다", action: "showResult" });
    expect(banner.lines[0]).toMatch(/^\d+\/\d+ \d{2}:\d{2}에 완료 묶음으로 고정되었습니다/);
  });
});
