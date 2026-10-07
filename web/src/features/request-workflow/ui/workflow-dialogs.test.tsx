import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { requestApi, type RequestDetail } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import { request101U2, request107U2 } from "@fixtures/api-snapshot";
import { AssignDialog } from "./assign-dialog";
import { CompleteDialog } from "./complete-dialog";
import { RecallDecisionDialog } from "./recall-dialogs";
import type { ReviewerCandidate } from "./reviewer-picker";

vi.mock("@/shared/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ui")>()),
  toast: vi.fn(),
}));

const NAMES: Record<number, string> = { 1: "김서연", 2: "박지훈", 3: "이도현", 4: "최민아", 6: "한가을", 7: "오세린" };
const users: UserDirectory = {
  get: (id) => (id && NAMES[id] ? { id, name: NAMES[id], dept: "", email: "", active: true, avatarColor: "#000" } : undefined),
  name: (id) => (id ? (NAMES[id] ?? "-") : "-"),
  ready: true,
};
const CANDIDATES: ReviewerCandidate[] = [
  { id: 2, name: "박지훈", activeCount: 3 },
  { id: 3, name: "이도현", activeCount: 3 },
  { id: 6, name: "한가을", activeCount: 2 },
];
const waiting: RequestDetail = {
  ...request101U2,
  status: "WAITING",
  reviewerIds: [],
  primaryReviewerId: null,
  dueDate: "2026-10-10",
  allowedActions: ["ASSIGN"],
};
const common = { onClose: vi.fn(), rowVersion: () => 9, onDone: vi.fn(), onStale: vi.fn() };

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast).mockClear();
  common.onDone.mockClear();
  common.onStale.mockClear();
  common.onClose.mockClear();
});

describe("AssignDialog", () => {
  it("validates like the reference (toast) and auto-selects the only reviewer as primary", async () => {
    const assign = vi.spyOn(requestApi, "assign").mockResolvedValue({ ...waiting, status: "IN_REVIEW" });
    render(<AssignDialog {...common} mode="assign" request={waiting} candidates={CANDIDATES} />);
    const dialog = screen.getByRole("dialog", { name: "검수자 배정" });
    expect(within(dialog).getByText("활성 2건")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "배정" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("검수자를 한 명 이상 고르세요"));
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /한가을/ }));
    expect(within(dialog).getByRole("button", { name: "한가을", pressed: true })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /박지훈/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "박지훈" }));
    fireEvent.change(within(dialog).getByLabelText("긴급도"), { target: { value: "URGENT" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "배정" }));
    await waitFor(() => expect(common.onDone).toHaveBeenCalled());
    expect(assign).toHaveBeenCalledWith(waiting.id, 9, {
      reviewerIds: [2, 6],
      primaryReviewerId: 2,
      dueDate: "2026-10-10",
      urgency: "URGENT",
    });
  });

  it("change mode requires a reason and handover and refuses a no-op", async () => {
    const change = vi.spyOn(requestApi, "changeAssignment").mockResolvedValue(request101U2);
    render(<AssignDialog {...common} mode="change" request={request101U2} candidates={CANDIDATES} />);
    const dialog = screen.getByRole("dialog", { name: "검수자 변경" });
    fireEvent.change(within(dialog).getByLabelText("변경 사유"), { target: { value: "휴가" } });
    fireEvent.change(within(dialog).getByLabelText("인수인계 내용"), { target: { value: "C2 문안 확인 중" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "변경" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("변경된 검수자나 주담당이 없습니다"));
    fireEvent.click(within(dialog).getByRole("button", { name: "한가을" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "변경" }));
    await waitFor(() => expect(change).toHaveBeenCalled());
    expect(change.mock.calls[0][2]).toEqual({ reviewerIds: [2, 6], primaryReviewerId: 6, reason: "휴가", handover: "C2 문안 확인 중" });
  });

  it("a state conflict closes the modal with the reference toast and reloads", async () => {
    vi.spyOn(requestApi, "assign").mockRejectedValue(
      new ApiError(409, { code: "REQUEST_STATE_CONFLICT", message: "권한 또는 요청 상태가 변경되었습니다" }),
    );
    render(<AssignDialog {...common} mode="assign" request={waiting} candidates={CANDIDATES} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /박지훈/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "배정" }));
    await waitFor(() => expect(common.onStale).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith("권한 또는 요청 상태가 변경되었습니다");
    expect(common.onClose).toHaveBeenCalled();
  });
});

describe("RecallDecisionDialog", () => {
  it("requires a comment, then sends the decision", async () => {
    const decide = vi.spyOn(requestApi, "decideRecall").mockResolvedValue({ ...request107U2, recallRequested: false });
    render(<RecallDecisionDialog {...common} approve={false} request={request107U2} />);
    const dialog = screen.getByRole("dialog", { name: "회수를 거절할까요?" });
    expect(within(dialog).getByText("현재 배정으로 검수를 이어갑니다.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "회수 거절" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("처리 의견을(를) 입력하세요"));
    expect(decide).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("처리 의견"), { target: { value: "  검수 마무리 단계입니다  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "회수 거절" }));
    await waitFor(() => expect(common.onDone).toHaveBeenCalled());
    expect(decide).toHaveBeenCalledWith(request107U2.id, 9, false, "검수 마무리 단계입니다");
  });

  it("approval explains that the assignment is released", () => {
    render(<RecallDecisionDialog {...common} approve request={request107U2} />);
    const dialog = screen.getByRole("dialog", { name: "회수를 승인할까요?" });
    expect(within(dialog).getByText(/현재 배정이 해제됩니다/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "회수 승인" })).toBeTruthy();
  });
});

describe("CompleteDialog", () => {
  const reviewing: RequestDetail = {
    ...request101U2,
    eligibleApproverIds: [4],
    coReviewers: [
      { userId: 2, current: true, primary: true, opinionCount: 0, rounds: [] },
      { userId: 6, current: true, primary: false, opinionCount: 1, rounds: [{ round: 1, count: 1 }] },
      { userId: 7, current: false, primary: false, opinionCount: 2, rounds: [{ round: 1, count: 2 }] },
    ],
  };

  it("lists 공동 검수 결과 with primary / earlier labels and needs the confirmation", async () => {
    const complete = vi.spyOn(requestApi, "complete").mockResolvedValue({ ...reviewing, status: "APPROVAL_WAITING" });
    render(<CompleteDialog {...common} open request={reviewing} meId={2} approvalEnabled users={users} />);
    const dialog = screen.getByRole("dialog", { name: "검수를 완료할까요?" });
    expect(within(dialog).getByText("완료하면 승인 대기로 바뀌고 최민아에게 알립니다.")).toBeTruthy();
    const results = within(dialog).getByRole("region", { name: "공동 검수 결과" });
    expect(within(results).getByText("박지훈 (주담당)")).toBeTruthy();
    expect(within(results).getByText("한가을")).toBeTruthy();
    expect(within(results).getByText("오세린 (이전 담당)")).toBeTruthy();
    expect(within(results).getByText("검수 의견 2건")).toBeTruthy();
    const ok = within(dialog).getByRole("button", { name: "검수 완료하고 승인 요청" }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "공동 검수 결과와 대상 버전을 확인했습니다" }));
    expect(ok.disabled).toBe(false);
    fireEvent.click(ok);
    await waitFor(() => expect(common.onDone).toHaveBeenCalled());
    expect(complete).toHaveBeenCalledWith(reviewing.id, 9);
    expect(toast).toHaveBeenCalledWith("승인 대기로 넘겼습니다");
  });

  it("lists the final-content problems of a VALIDATION_FAILED answer", async () => {
    vi.spyOn(requestApi, "complete").mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "최종 콘텐츠의 필수값과 연결값을 확인하세요",
        details: ["C1: 미등록 또는 사용 중지 변수 old_key"],
      }),
    );
    const { rerender } = render(
      <CompleteDialog {...common} open request={reviewing} meId={2} approvalEnabled={false} users={users} />,
    );
    const dialog = screen.getByRole("dialog", { name: "검수를 완료할까요?" });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "검수 완료" }));
    await waitFor(() => expect(common.onClose).toHaveBeenCalled());
    rerender(<CompleteDialog {...common} open={false} request={reviewing} meId={2} approvalEnabled={false} users={users} />);
    const invalid = await screen.findByRole("dialog", { name: "최종 콘텐츠의 필수값과 연결값을 확인하세요" });
    expect(within(invalid).getByText("C1: 미등록 또는 사용 중지 변수 old_key")).toBeTruthy();
  });
});
