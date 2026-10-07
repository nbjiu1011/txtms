import { describe, expect, it } from "vitest";
import { canEditContentByPolicy, readOnlyReason } from "./edit-reason";
import type { RequestStatus } from "./types";

const ME = 1;
const req = (status: RequestStatus, over: Partial<{ recallRequested: boolean; requesterId: number }> = {}) => ({
  status,
  recallRequested: false,
  requesterId: 9,
  ...over,
});

describe("readOnlyReason", () => {
  it.each<[RequestStatus, string]>([
    ["WAITING", "배정 대기 중에는 편집할 수 없습니다. 수정이 필요하면 요청을 취소한 뒤 다시 작성하세요."],
    ["IN_REVIEW", "배정된 검수자만 검수 중에 편집할 수 있습니다."],
    ["CONFIRMING", "확인 요청 중에는 요청자만 본인 콘텐츠를 수정할 수 있습니다."],
    ["APPROVAL_WAITING", "승인 대기 중에는 콘텐츠 버전이 고정됩니다."],
    ["REVIEW_COMPLETED", "완료된 요청입니다. 수정은 후속 요청으로 시작합니다."],
    ["APPROVED", "완료된 요청입니다. 수정은 후속 요청으로 시작합니다."],
    ["DRAFT", "이 요청을 편집할 권한이 없습니다."],
  ])("%s", (status, text) => {
    expect(readOnlyReason(req(status), ME)).toBe(text);
  });

  it("explains the requester's own pending recall", () => {
    expect(readOnlyReason(req("IN_REVIEW", { recallRequested: true, requesterId: ME }), ME)).toBe(
      "회수 요청 처리 중에는 편집할 수 없습니다.",
    );
  });

  it("keeps the reviewer message for a recall by someone else", () => {
    expect(readOnlyReason(req("IN_REVIEW", { recallRequested: true }), ME)).toBe(
      "배정된 검수자만 검수 중에 편집할 수 있습니다.",
    );
  });
});

describe("canEditContentByPolicy", () => {
  it("requires EDIT_CONTENT", () => {
    expect(canEditContentByPolicy({ ...req("IN_REVIEW"), allowedActions: ["REVIEW"] }, ME)).toBe(false);
    expect(canEditContentByPolicy({ ...req("IN_REVIEW"), allowedActions: ["EDIT_CONTENT"] }, ME)).toBe(true);
  });

  it("is false for the requester while their recall is pending", () => {
    expect(
      canEditContentByPolicy(
        { ...req("IN_REVIEW", { recallRequested: true, requesterId: ME }), allowedActions: ["EDIT_CONTENT"] },
        ME,
      ),
    ).toBe(false);
  });
});
