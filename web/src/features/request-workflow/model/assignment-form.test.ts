import { describe, expect, it } from "vitest";
import {
  firstMissing,
  initialAssignmentForm,
  toAssignBody,
  toChangeBody,
  toggleReviewer,
  validateAssignment,
  type AssignmentForm,
} from "./assignment-form";

const ORDER = [2, 3, 6];
const waiting = { reviewerIds: [], primaryReviewerId: null, dueDate: "2026-10-10", urgency: "NORMAL" as const };
const reviewing = { reviewerIds: [2, 6], primaryReviewerId: 2, dueDate: "2026-10-09", urgency: "NORMAL" as const };

describe("assignment form", () => {
  it("starts from the current assignment and due date", () => {
    expect(initialAssignmentForm(waiting)).toMatchObject({ reviewerIds: [], primaryId: null, dueDate: "2026-10-10" });
    expect(initialAssignmentForm(reviewing)).toMatchObject({ reviewerIds: [2, 6], primaryId: 2 });
  });

  it("a single selected reviewer becomes the primary automatically", () => {
    const form = toggleReviewer(initialAssignmentForm(waiting), 6, true, ORDER);
    expect(form).toMatchObject({ reviewerIds: [6], primaryId: 6 });
    const two = toggleReviewer(form, 2, true, ORDER);
    expect(two).toMatchObject({ reviewerIds: [2, 6], primaryId: 6 });
  });

  it("unchecking the primary clears it (unless one reviewer is left)", () => {
    let form = toggleReviewer(toggleReviewer(initialAssignmentForm(waiting), 2, true, ORDER), 3, true, ORDER);
    form = toggleReviewer({ ...form, primaryId: 3 }, 6, true, ORDER);
    expect(toggleReviewer(form, 3, false, ORDER)).toMatchObject({ reviewerIds: [2, 6], primaryId: null });
    expect(toggleReviewer({ ...form, reviewerIds: [2, 3], primaryId: 3 }, 3, false, ORDER)).toMatchObject({
      reviewerIds: [2],
      primaryId: 2,
    });
  });

  it("keeps the candidate order whatever the click order", () => {
    const form = [6, 2, 3].reduce((f, id) => toggleReviewer(f, id, true, ORDER), initialAssignmentForm(waiting));
    expect(form.reviewerIds).toEqual([2, 3, 6]);
  });

  describe("validation (server order)", () => {
    const base: AssignmentForm = {
      reviewerIds: [2, 6],
      primaryId: 2,
      dueDate: "2026-10-12",
      urgency: "URGENT",
      reason: "",
      handover: "",
    };

    it("assign: reviewers >= 1, then primary, then due date", () => {
      expect(validateAssignment({ ...base, reviewerIds: [], primaryId: null }, "assign", waiting)).toBe(
        "검수자를 한 명 이상 고르세요",
      );
      expect(validateAssignment({ ...base, primaryId: null }, "assign", waiting)).toBe("주담당 검수자를 지정하세요");
      expect(validateAssignment({ ...base, primaryId: 3 }, "assign", waiting)).toBe("주담당 검수자를 지정하세요");
      expect(validateAssignment({ ...base, dueDate: "" }, "assign", waiting)).toBe("확정 납기를 입력하세요");
      expect(validateAssignment(base, "assign", waiting)).toBeNull();
    });

    it("change: reason and handover are required, a no-op change is refused", () => {
      expect(validateAssignment(base, "change", reviewing)).toBe("변경 사유을(를) 입력하세요");
      expect(validateAssignment({ ...base, reason: "휴가" }, "change", reviewing)).toBe("인수인계 내용을(를) 입력하세요");
      const filled = { ...base, reason: "휴가", handover: "C2 확인 필요" };
      expect(validateAssignment(filled, "change", reviewing)).toBe("변경된 검수자나 주담당이 없습니다");
      expect(validateAssignment({ ...filled, reviewerIds: [6, 2] }, "change", reviewing)).toBe(
        "변경된 검수자나 주담당이 없습니다",
      );
      expect(validateAssignment({ ...filled, primaryId: 6 }, "change", reviewing)).toBeNull();
      expect(validateAssignment({ ...filled, reviewerIds: [2, 3], primaryId: 2 }, "change", reviewing)).toBeNull();
      expect(validateAssignment({ ...filled, reason: "   " }, "change", reviewing)).toBe("변경 사유을(를) 입력하세요");
    });
  });

  it("maps to the contract bodies (trimmed free text)", () => {
    const form: AssignmentForm = {
      reviewerIds: [2, 6],
      primaryId: 6,
      dueDate: "2026-10-12",
      urgency: "URGENT",
      reason: " 휴가 ",
      handover: " 인계 ",
    };
    expect(toAssignBody(form)).toEqual({ reviewerIds: [2, 6], primaryReviewerId: 6, dueDate: "2026-10-12", urgency: "URGENT" });
    expect(toChangeBody(form)).toEqual({ reviewerIds: [2, 6], primaryReviewerId: 6, reason: "휴가", handover: "인계" });
  });

  it("firstMissing uses the reference `{label}을(를) 입력하세요` text", () => {
    expect(
      firstMissing([
        ["", "이유"],
        ["", "기대 내용"],
      ]),
    ).toBe("이유을(를) 입력하세요");
    expect(
      firstMissing([
        ["x", "이유"],
        [" ", "기대 내용"],
      ]),
    ).toBe("기대 내용을(를) 입력하세요");
    expect(firstMissing([["x", "이유"]])).toBeNull();
  });
});
