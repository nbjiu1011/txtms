import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ArchiveLine } from "@/entities/request";
import { ArchiveTable, type ArchiveTableProps } from "./archive-table";

function line(overrides: Partial<ArchiveLine> = {}): ArchiveLine {
  return {
    lineKey: "REQ-2609-088:C1",
    latest: {
      requestId: "REQ-2609-106",
      contentKey: "C1",
      title: "청구 금액 안내",
      version: 1,
      type: "ALIMTALK",
      status: "APPROVED",
      completedAt: "2026-10-02T02:00:00Z",
      campaign: null,
      preview: "홍길동님, 9월 청구 금액은 152,300원입니다.",
      previewRaw: "#{customer_name}님, 9월 청구 금액은 #{amount}원입니다.",
      fileNames: [],
      resolvedText: "홍길동님, 9월 청구 금액은 152,300원입니다.",
    },
    past: [
      {
        requestId: "REQ-2609-088",
        contentKey: "C1",
        title: "청구 금액 안내",
        requestTitle: "청구 금액 안내 (8월)",
        version: 1,
        completedAt: "2026-09-07T01:00:00Z",
      },
    ],
    followUps: [{ requestId: "REQ-2610-130", status: "DRAFT", title: "" }],
    campaigns: [],
    ...overrides,
  };
}

function setup(overrides: Partial<ArchiveTableProps> = {}) {
  const props: ArchiveTableProps = {
    lines: [line()],
    open: {},
    onToggle: vi.fn(),
    onOpenRequest: vi.fn(),
    onOpenContent: vi.fn(),
    onCopy: vi.fn(),
    ...overrides,
  };
  render(<ArchiveTable {...props} />);
  return { props, row: screen.getByRole("row", { name: /청구 금액 안내 v1/ }) };
}

describe("ArchiveTable", () => {
  it("renders the latest completion: title, version, request, type, status and preview", () => {
    const { row } = setup();
    expect(within(row).getByText("REQ-2609-106")).toBeTruthy();
    expect(within(row).getByText("알림톡")).toBeTruthy();
    expect(within(row).getByText("승인 완료")).toBeTruthy();
    // reference `renderVars`: the raw preview with variable chips (contract §14.3 `previewRaw`)
    expect(within(row).getByText("customer_name")).toBeTruthy();
    expect(within(row).queryByText(/152,300/)).toBeNull();
    expect(within(row).queryByText(/과거 완료본/)).toBeNull();
  });

  it("a row click or the title opens the latest content", () => {
    const { row, props } = setup();
    // a plain cell (react-data-table-component counts clicks on the cell element itself)
    fireEvent.click(within(row).getByText("REQ-2609-106").closest('[role="cell"]')!);
    expect(props.onOpenContent).toHaveBeenCalledWith("REQ-2609-106", "C1");
    fireEvent.click(within(row).getByRole("button", { name: "청구 금액 안내 v1 열기" }));
    expect(props.onOpenContent).toHaveBeenCalledTimes(2);
  });

  it("이력 {n} (past + follow-ups) toggles the line without opening it", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "청구 금액 안내 이력 2" }));
    expect(props.onToggle).toHaveBeenCalledWith("REQ-2609-088:C1");
    expect(props.onOpenContent).not.toHaveBeenCalled();
  });

  it("unfolded history links the requests; a titleless follow-up reads 제목 없음", () => {
    const { row } = setup({ open: { "REQ-2609-088:C1": true } });
    expect(within(row).getByRole("button", { name: "청구 금액 안내 접기" }).getAttribute("aria-expanded")).toBe("true");
    expect(within(row).getByText(/과거 완료본/).textContent).toContain("REQ-2609-088 청구 금액 안내 (8월) v1");
    const follow = within(row).getByRole("link", { name: "REQ-2610-130" }).parentElement!;
    expect(follow.textContent).toMatch(/^후속 요청 REQ-2610-130/);
    expect(follow.textContent).toContain("작성 중");
    expect(follow.textContent).toContain("제목 없음");
    expect(within(row).getByRole("link", { name: "REQ-2610-130" }).getAttribute("href")).toBe("/requests/REQ-2610-130");
    expect(within(row).getByRole("link", { name: "REQ-2609-088" }).getAttribute("href")).toBe("/requests/REQ-2609-088");
  });

  it("a line without linked entries says 없음 and has no toggle", () => {
    const { row } = setup({ lines: [line({ past: [], followUps: [] })] });
    expect(within(row).getByText("없음")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /이력/ })).toBeNull();
  });

  it("복사 is the one row action, offered for text contents only", () => {
    const { row, props } = setup();
    fireEvent.click(within(row).getByRole("button", { name: "청구 금액 안내 복사" }));
    expect(props.onCopy).toHaveBeenCalledWith(props.lines[0]);
    expect(props.onOpenContent).not.toHaveBeenCalled();
    expect(within(row).queryByRole("button", { name: /후속 요청|새 탭/ })).toBeNull();
  });

  it("hides copy for attachments", () => {
    const withFile = line();
    withFile.latest.fileNames = ["약관.pdf"];
    const { row } = setup({ lines: [withFile] });
    expect(within(row).queryByRole("button", { name: /복사/ })).toBeNull();
  });
});
