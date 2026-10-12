import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { requestApi, type RequestDetail } from "@/entities/request";
import { request102U1 } from "@fixtures/api-snapshot";
import { SubmitRequestDialog, type SubmitRequestDialogProps } from "./submit-request-dialog";

const MISSING = {
  details: ["요청 정보: 대상 고객", "C1 콘텐츠 1: 승인 템플릿"],
  fieldErrors: [{ field: "target", message: "대상 고객을(를) 입력하세요" }],
  warnings: [],
};
const WARNINGS = ["C1 콘텐츠 1: 본문 1,000자 초과 (1,001자)", "C1 콘텐츠 1: 버튼 5개 초과 (6개)"];

function setup(overrides: Partial<SubmitRequestDialogProps> = {}) {
  const props: SubmitRequestDialogProps = {
    open: true,
    onClose: vi.fn(),
    request: { id: "REQ-2609-105", contents: request102U1.contents, round: 1, nextSubmitRound: 1 },
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

/** The pre-check passes (`ok: true`): the confirmation opens. */
function precheckPasses() {
  return vi.spyOn(requestApi, "submitCheck").mockResolvedValue({ ok: true, details: [], fieldErrors: [], warnings: [] });
}

/** A server without the pre-check answers 404: the confirmation opens directly (graceful fallback). */
function noPrecheck() {
  return vi.spyOn(requestApi, "submitCheck").mockRejectedValue(new ApiError(404, { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다" }));
}

describe("SubmitRequestDialog", () => {
  beforeEach(() => {
    precheckPasses();
  });
  afterEach(() => vi.restoreAllMocks());

  it("asks for confirmation with the lead reviewer and the optional correction note", async () => {
    setup();
    const dialog = await screen.findByRole("dialog", { name: "검수를 요청할까요?" });
    expect(within(dialog).getByText(`${request102U1.contents.length}건의 콘텐츠를 카드 혜택 알림 대표 검수자 이도현님에게 보냅니다.`)).toBeTruthy();
    expect(within(dialog).getByText(/텍스트 교정 결과는 필요하지 않습니다/)).toBeTruthy();
    expect(within(dialog).queryByText(/검수 차수가/)).toBeNull();
  });

  it("announces the round increase after an approved recall (nextSubmitRound)", async () => {
    setup({ request: { id: "REQ-2609-105", contents: request102U1.contents, round: 1, nextSubmitRound: 2 } });
    const dialog = await screen.findByRole("dialog", { name: "검수를 요청할까요?" });
    expect(within(dialog).getByText("회수 승인 후 다시 요청하므로 검수 차수가 2차로 올라갑니다.")).toBeTruthy();
  });

  it("shows the missing items before asking when the pre-check fails", async () => {
    vi.spyOn(requestApi, "submitCheck").mockResolvedValue({ ok: false, ...MISSING });
    const submit = vi.spyOn(requestApi, "submit");
    const { props, view } = setup();
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    view.rerender(<SubmitRequestDialog {...props} open={false} />);
    const missing = await screen.findByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" });
    expect(within(missing).getAllByRole("listitem").map((li) => li.textContent)).toEqual(MISSING.details);
    expect(within(missing).queryByRole("list", { name: "채널 규격 확인" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "검수를 요청할까요?" })).toBeNull();
    expect(props.onInvalid).toHaveBeenCalledWith(MISSING.fieldErrors);
    expect(submit).not.toHaveBeenCalled();
  });

  it("lists channel spec warnings in the confirmation and still submits", async () => {
    vi.spyOn(requestApi, "submitCheck").mockResolvedValue({ ok: true, details: [], fieldErrors: [], warnings: WARNINGS });
    const detail = { ...request102U1, status: "WAITING" } as RequestDetail;
    vi.spyOn(requestApi, "submit").mockResolvedValue(detail);
    const { props } = setup();
    const confirm = await screen.findByRole("dialog", { name: "검수를 요청할까요?" });
    const list = within(confirm).getByRole("list", { name: "채널 규격 확인" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(WARNINGS);
    expect(within(confirm).getByText("규격 초과는 안내일 뿐 검수 요청을 막지 않습니다.")).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledWith(detail));
  });

  it("shows the warnings next to the missing items when the pre-check fails", async () => {
    vi.spyOn(requestApi, "submitCheck").mockResolvedValue({ ok: false, ...MISSING, warnings: WARNINGS });
    const { props, view } = setup();
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    view.rerender(<SubmitRequestDialog {...props} open={false} />);
    const missing = await screen.findByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" });
    const items = within(missing).getByRole("list", { name: "채울 항목" });
    expect(within(items).getAllByRole("listitem").map((li) => li.textContent)).toEqual(MISSING.details);
    const warned = within(missing).getByRole("list", { name: "채널 규격 확인" });
    expect(within(warned).getAllByRole("listitem").map((li) => li.textContent)).toEqual(WARNINGS);
  });

  it("asks for confirmation when the pre-check passes", async () => {
    vi.spyOn(requestApi, "submitCheck").mockResolvedValue({ ok: true, details: [], fieldErrors: [], warnings: [] });
    setup();
    expect(await screen.findByRole("dialog", { name: "검수를 요청할까요?" })).toBeTruthy();
  });

  it("falls back to listing the missing items of a VALIDATION_FAILED submit (no pre-check)", async () => {
    noPrecheck();
    vi.spyOn(requestApi, "submit").mockRejectedValue(
      new ApiError(400, { code: "VALIDATION_FAILED", message: "검수를 요청하려면 다음 항목을 채우세요", ...MISSING }),
    );
    const { props, view } = setup();
    const confirm = await screen.findByRole("dialog", { name: "검수를 요청할까요?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    view.rerender(<SubmitRequestDialog {...props} open={false} />);
    const missing = await screen.findByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" });
    expect(within(missing).getAllByRole("listitem").map((li) => li.textContent)).toEqual(MISSING.details);
    expect(within(missing).getByText("텍스트 교정 결과는 필요하지 않습니다.")).toBeTruthy();
    expect(props.onInvalid).toHaveBeenCalledWith(MISSING.fieldErrors);
    fireEvent.click(within(missing).getByRole("button", { name: "확인" }));
    expect(props.onShowMissing).toHaveBeenCalledWith("info");
  });

  it("submits with the current row version and an idempotency key", async () => {
    const detail = { ...request102U1, status: "WAITING" } as RequestDetail;
    const submit = vi.spyOn(requestApi, "submit").mockResolvedValue(detail);
    const { props } = setup();
    const confirm = await screen.findByRole("dialog", { name: "검수를 요청할까요?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "검수 요청" }));
    await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledWith(detail));
    expect(props.beforeSubmit).toHaveBeenCalled();
    expect(submit.mock.calls[0][0]).toBe("REQ-2609-105");
    expect(submit.mock.calls[0][1]).toBe(7);
    expect(submit.mock.calls[0][2]).toMatch(/.{8,}/);
  });

  it("does not check or submit when pending edits could not be saved", async () => {
    const check = vi.spyOn(requestApi, "submitCheck");
    const submit = vi.spyOn(requestApi, "submit");
    const { props } = setup({ beforeSubmit: vi.fn(async () => false) });
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(check).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "검수를 요청할까요?" })).toBeNull();
  });
});
