import { describe, expect, it } from "vitest";
import {
  CONTENT_TYPE_LABEL,
  CONTENT_TYPE_TONE,
  FILE_SCAN_STATUS_LABEL,
  FILE_UNIT_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  URGENCY_LABEL,
} from "./labels";
import { CONTENT_TYPES, FILE_SCAN_STATUSES, FILE_UNITS, REQUEST_STATUSES, URGENCIES } from "./types";

describe("request label maps", () => {
  it("labels every request status as in the contract", () => {
    expect(REQUEST_STATUSES.map((s) => REQUEST_STATUS_LABEL[s])).toEqual([
      "작성 중",
      "배정 대기",
      "검수 중",
      "확인 요청",
      "승인 대기",
      "검수 완료",
      "승인 완료",
    ]);
  });

  it("maps statuses to the reference tones (승인 완료 uses done)", () => {
    expect(REQUEST_STATUS_TONE).toEqual({
      DRAFT: "draft",
      WAITING: "wait",
      IN_REVIEW: "review",
      CONFIRMING: "ask",
      APPROVAL_WAITING: "appr",
      REVIEW_COMPLETED: "done",
      APPROVED: "done",
    });
  });

  it("labels content types with their tone/glyph", () => {
    expect(CONTENT_TYPES.map((t) => [CONTENT_TYPE_LABEL[t], CONTENT_TYPE_TONE[t]])).toEqual([
      ["알림톡", "a"],
      ["문자", "s"],
      ["RCS", "r"],
      ["자유입력형", "f"],
    ]);
  });

  it("labels urgency, file units and scan states", () => {
    expect(URGENCIES.map((u) => URGENCY_LABEL[u])).toEqual(["보통", "긴급"]);
    expect(FILE_UNITS.map((u) => FILE_UNIT_LABEL[u])).toEqual(["페이지", "행", "슬라이드", "줄", "장"]);
    expect(FILE_SCAN_STATUSES.map((s) => FILE_SCAN_STATUS_LABEL[s])).toEqual(["검사 중", "정상", "검사 실패", "위험 차단"]);
  });
});
