import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { requestApi, type RequestDetail } from "@/entities/request";
import { request102U1 } from "@fixtures/api-snapshot";
import { SubmitRequestDialog, type SubmitRequestDialogProps } from "./submit-request-dialog";

function setup(overrides: Partial<SubmitRequestDialogProps> = {}) {
  const props: SubmitRequestDialogProps = {
    open: true,
    onClose: vi.fn(),
    request: { id: "REQ-2609-105", contents: request102U1.contents },
    projectName: "카드 혜택 알림",
    leadName: "이도현",
    rowVersion: () => 7,
    beforeSubmit: vi.fn(async () => true),
    onSubmitted: vi.fn(),
    onInvalid: vi.fn(),
    onShowMissing: vi.fn(),
    onStale: vi.fn(),
    ...overrides,
  };
  const view = render(<SubmitRequestDialog {...props} />);
  return { props, view };
}

describe("SubmitRequestDialog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks for confirmation with the lead reviewer and the optional correction note", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "검수를 요청할까요?" });
    expect(within(dialog).getByText(`${request102U1.contents.length}건의 콘텐츠를 카드 혜택 알림 대표 검수자 이도현님에게 보냅니다.`)).toBeTruthy();
    expect(within(dialog).getByText(/텍스트 교정 결과는 필요하지 않습니다/)).toBeTruthy();
  });

  it("lists the missing items of a VALIDATION_FAILED answer like the reference modal", async () => {
    vi.spyOn(requestApi, "submit").mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "검수를 요청하려면 다음 항목을 채우세요",
        details: ["요청 정보: 대상 고객", "C1 콘텐츠 1: 승인 템플릿"],
        fieldErrors: [{ field: "target", message: "대상 고객을(를) 입력하세요" }],
      }),
    );
    const { props, view } = setup();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    view.rerender(<SubmitRequestDialog {...props} open={false} />);
    const missing = await screen.findByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" });
    expect(within(missing).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "요청 정보: 대상 고객",
      "C1 콘텐츠 1: 승인 템플릿",
    ]);
    expect(within(missing).getByText("텍스트 교정 결과는 필요하지 않습니다.")).toBeTruthy();
    expect(props.onInvalid).toHaveBeenCalledWith([{ field: "target", message: "대상 고객을(를) 입력하세요" }]);
    fireEvent.click(within(missing).getByRole("button", { name: "확인" }));
    expect(props.onShowMissing).toHaveBeenCalledWith("info");
  });

  it("submits with the current row version and an idempotency key", async () => {
    const detail = { ...request102U1, status: "WAITING" } as RequestDetail;
    const submit = vi.spyOn(requestApi, "submit").mockResolvedValue(detail);
    const { props } = setup();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledWith(detail));
    expect(props.beforeSubmit).toHaveBeenCalled();
    expect(submit.mock.calls[0][0]).toBe("REQ-2609-105");
    expect(submit.mock.calls[0][1]).toBe(7);
    expect(submit.mock.calls[0][2]).toMatch(/.{8,}/);
  });

  it("does not submit when pending edits could not be saved", async () => {
    const submit = vi.spyOn(requestApi, "submit");
    const { props } = setup({ beforeSubmit: vi.fn(async () => false) });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.beforeSubmit).toHaveBeenCalled());
    expect(submit).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
