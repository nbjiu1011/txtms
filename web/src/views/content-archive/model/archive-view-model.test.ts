import { describe, expect, it } from "vitest";
import type { ArchiveLine } from "@/entities/request";
import {
  EMPTY_ARCHIVE_FILTERS,
  archiveFiltersToParams,
  canCopyLine,
  lineHistoryCount,
  lineMeta,
  lineToggleLabel,
} from "./archive-view-model";

function archiveLine(overrides: Partial<ArchiveLine> = {}): ArchiveLine {
  return {
    lineKey: "REQ-2609-088:C1",
    latest: {
      requestId: "REQ-2609-106",
      contentKey: "C1",
      title: "청구 금액 안내",
      version: 2,
      type: "ALIMTALK",
      status: "APPROVED",
      completedAt: "2026-10-02T02:00:00Z",
      campaign: "10월 혜택",
      preview: "홍길동님, 9월 청구 금액은 152,300원입니다.",
      previewRaw: "#{customer_name}님, 9월 청구 금액은 #{amount}원입니다.",
      fileNames: [],
      resolvedText: "홍길동님, 9월 청구 금액은 152,300원입니다.",
    },
    past: [],
    followUps: [],
    campaigns: ["10월 혜택"],
    ...overrides,
  };
}

const past = { requestId: "REQ-2609-088", contentKey: "C1", title: "청구 금액 안내", requestTitle: "청구 금액 안내 (8월)", version: 1, completedAt: "2026-09-07T01:00:00Z" };
const followUp = { requestId: "REQ-2610-130", status: "DRAFT" as const, title: "청구 금액 안내 후속" };

describe("lineToggleLabel", () => {
  it("is 이력 without past completions or follow-ups, open or not", () => {
    expect(lineToggleLabel(archiveLine(), false)).toBe("이력");
    expect(lineToggleLabel(archiveLine(), true)).toBe("이력");
  });

  it("counts past completions and follow-ups while collapsed, 접기 while expanded", () => {
    const line = archiveLine({ past: [past], followUps: [followUp] });
    expect(lineHistoryCount(line)).toBe(2);
    expect(lineToggleLabel(line, false)).toBe("이력 2");
    expect(lineToggleLabel(line, true)).toBe("접기");
    expect(lineToggleLabel(archiveLine({ followUps: [followUp] }), false)).toBe("이력 1");
  });
});

describe("archiveFiltersToParams", () => {
  it("sends only the project for empty filters", () => {
    expect(archiveFiltersToParams(1, EMPTY_ARCHIVE_FILTERS)).toEqual({ projectId: 1 });
  });

  it("maps every filter to the contract query (trimmed text, KST dates)", () => {
    expect(
      archiveFiltersToParams(3, {
        q: "  청구 ",
        type: "SMS",
        campaign: "10월 혜택",
        status: "REVIEW_COMPLETED",
        from: "2026-10-01",
        to: "2026-10-07",
      }),
    ).toEqual({
      projectId: 3,
      q: "청구",
      type: "SMS",
      campaign: "10월 혜택",
      status: "REVIEW_COMPLETED",
      completedFrom: "2026-10-01",
      completedTo: "2026-10-07",
    });
  });

  it("drops a blank search", () => {
    expect(archiveFiltersToParams(1, { ...EMPTY_ARCHIVE_FILTERS, q: "   " })).toEqual({ projectId: 1 });
  });
});

describe("line texts", () => {
  it("shows request, type label, status label, completion date and campaign", () => {
    expect(lineMeta(archiveLine().latest)).toMatch(/^REQ-2609-106 {2}알림톡 {2}승인 완료 {2}.+ {2}10월 혜택$/);
    const noCampaign = archiveLine();
    noCampaign.latest.campaign = null;
    expect(lineMeta(noCampaign.latest)).not.toMatch(/ {2}$/);
  });

  it("offers copy only for text contents", () => {
    expect(canCopyLine(archiveLine())).toBe(true);
    const withFile = archiveLine();
    withFile.latest.fileNames = ["약관.pdf"];
    expect(canCopyLine(withFile)).toBe(false);
  });
});
