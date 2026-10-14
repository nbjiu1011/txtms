import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { performableActions, type RequestDetail } from "@/entities/request";
import { copyCompletedText } from "@/features/completed-output";
import { request088U1 } from "@fixtures/api-snapshot";
import { headerButtons } from "../model/header-actions";
import type { RequestPage } from "../model/use-request-page";
import { ResultTab } from "./result-tab";

vi.mock("@/features/completed-output", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/completed-output")>()),
  copyCompletedText: vi.fn(async () => true),
}));

function page(request: RequestDetail = request088U1): RequestPage {
  return {
    request,
    project: null,
    customer: null,
    users: { get: () => undefined, name: (id) => (id === 4 ? "최민아" : "-"), ready: true },
    variableValues: new Map(),
    mockEnabled: true,
    channelSpec: null,
  };
}

describe("ResultTab", () => {
  afterEach(() => vi.mocked(copyCompletedText).mockClear());

  it("shows the bundle head, items and the completion-time variables", () => {
    render(<ResultTab page={page()} performable={performableActions(request088U1.allowedActions)} onOpenContent={vi.fn()} />);
    expect(screen.getByText(/승인 완료 .* 처리 최민아 콘텐츠 1건/)).toBeTruthy();
    expect(screen.getByRole("row", { name: /C1 청구 금액 안내/ })).toBeTruthy();
    expect(screen.getByText("billing_amount = 152,300원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "요청 전체 XLSX 반출" })).toBeTruthy();
    // No attachments → no ZIP export.
    expect(screen.queryByRole("button", { name: "첨부 최종본 묶음" })).toBeNull();
  });

  it("copies the body with completion-time variable values", () => {
    render(<ResultTab page={page()} performable={performableActions(request088U1.allowedActions)} onOpenContent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "C1 문안 복사" }));
    expect(copyCompletedText).toHaveBeenCalledWith({
      requestId: "REQ-2609-088",
      contentKey: "C1",
      text: "홍길동님, 8월 청구 금액은 152,300원입니다.\n결제일: 25일",
    });
  });

  it("a row (or its title) opens the content tab; 복사 is the only row action", () => {
    const onOpenContent = vi.fn();
    render(
      <ResultTab page={page()} performable={performableActions(request088U1.allowedActions)} onOpenContent={onOpenContent} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "C1 청구 금액 안내 열기" }));
    expect(onOpenContent).toHaveBeenCalledWith("C1");
    // a plain-text cell counts as a row click
    fireEvent.click(screen.getByText("v" + request088U1.bundle!.items[0].version).closest('[role="cell"]')!);
    expect(onOpenContent).toHaveBeenCalledTimes(2);
    // 복사 does not open the row; 후속 요청 lives in the content tab and the request header
    fireEvent.click(screen.getByRole("button", { name: "C1 문안 복사" }));
    expect(onOpenContent).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /후속 요청/ })).toBeNull();
  });

  it("opens the XLSX confirmation with title, item count and KST completion date", async () => {
    render(<ResultTab page={page()} performable={performableActions(request088U1.allowedActions)} onOpenContent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "요청 전체 XLSX 반출" }));
    const dialog = await screen.findByRole("dialog", { name: "요청 전체 XLSX 반출" });
    // the seed completion date moves with the seeding day: format it in KST like the dialog
    const kstDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
      new Date(request088U1.bundle!.completedAt),
    );
    expect(within(dialog).getByText(`${request088U1.title} · 콘텐츠 1건 · ${kstDate} (KST)`)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "파일 받기" })).toBeTruthy();
  });

  it("shows the ZIP export when an item has attachments; no export without EXPORT", async () => {
    const bundle = request088U1.bundle!;
    const withFile = {
      ...request088U1,
      bundle: { ...bundle, items: [{ ...bundle.items[0], files: [{ ...request088U1.contents[0], id: 1, name: "약관.pdf", version: 2 }] }] },
    } as unknown as RequestDetail;
    const { unmount } = render(
      <ResultTab page={page(withFile)} performable={performableActions(request088U1.allowedActions)} onOpenContent={vi.fn()} />,
    );
    expect(screen.getByText("약관.pdf (v2)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "C1 문안 복사" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "첨부 최종본 묶음" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "첨부 최종본 ZIP" })).toBeTruthy());
    unmount();
    render(<ResultTab page={page()} performable={new Set()} onOpenContent={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "요청 전체 XLSX 반출" })).toBeNull();
  });
});

describe("header 후속 요청 작성", () => {
  it("is shown for a completed request the requester may follow up", () => {
    const labels = headerButtons(performableActions(request088U1.allowedActions)).map((b) => b.label);
    expect(labels).toEqual(["복제", "후속 요청 작성"]);
    expect(headerButtons(performableActions(["CLONE"])).map((b) => b.label)).toEqual(["복제"]);
  });
});
