import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ArchiveLine } from "@/entities/request";
import { ArchiveLineItem, type ArchiveLineItemProps } from "./archive-line";

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
    past: [{ requestId: "REQ-2609-088", contentKey: "C1", title: "청구 금액 안내", requestTitle: "청구 금액 안내 (8월)", version: 1, completedAt: "2026-09-07T01:00:00Z" }],
    followUps: [{ requestId: "REQ-2610-130", status: "DRAFT", title: "" }],
    campaigns: [],
    ...overrides,
  };
}

function setup(overrides: Partial<ArchiveLineItemProps> = {}) {
  const props: ArchiveLineItemProps = {
    line: line(),
    open: false,
    onToggle: vi.fn(),
    onOpenRequest: vi.fn(),
    onOpenContent: vi.fn(),
    onCopy: vi.fn(),
    onFollowUp: vi.fn(),
    ...overrides,
  };
  render(<ArchiveLineItem {...props} />);
  return { props, item: screen.getByRole("listitem", { name: "청구 금액 안내 v1" }) };
}

describe("ArchiveLineItem", () => {
  it("renders the latest completion: title, version, meta and preview", () => {
    const { item } = setup();
    expect(within(item).getByText("REQ-2609-106  알림톡  승인 완료", { exact: false, normalizer: (s) => s })).toBeTruthy();
    // reference `renderVars`: the raw preview with variable chips (contract §14.3 `previewRaw`)
    expect(within(item).getByText("customer_name")).toBeTruthy();
    expect(within(item).getByText("amount")).toBeTruthy();
    expect(within(item).queryByText(/152,300/)).toBeNull();
    expect(within(item).queryByText(/과거 완료본/)).toBeNull();
  });

  it("collapsed: 이력 {n} (past + follow-ups) toggles the line", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "이력 2" }));
    expect(props.onToggle).toHaveBeenCalled();
  });

  it("expanded rows link the requests; a titleless follow-up reads 제목 없음", () => {
    const { item } = setup({ open: true });
    expect(within(item).getByRole("button", { name: "접기" }).getAttribute("aria-expanded")).toBe("true");
    expect(within(item).getByText(/과거 완료본/).textContent).toContain("REQ-2609-088 청구 금액 안내 (8월) v1");
    const follow = within(item).getByRole("link", { name: "REQ-2610-130" }).parentElement!;
    expect(follow.textContent).toMatch(/^후속 요청 REQ-2610-130/);
    expect(follow.textContent).toContain("작성 중");
    expect(follow.textContent).toContain("제목 없음");
    // The tab opens through the router (onNavigate, covered by the real-API flow); the href is the request URL.
    expect(within(item).getByRole("link", { name: "REQ-2610-130" }).getAttribute("href")).toBe("/requests/REQ-2610-130");
    expect(within(item).getByRole("link", { name: "REQ-2609-088" }).getAttribute("href")).toBe("/requests/REQ-2609-088");
  });

  it("expanded without linked entries says so", () => {
    const { item } = setup({ open: true, line: line({ past: [], followUps: [] }) });
    expect(within(item).getByRole("button", { name: "이력" })).toBeTruthy();
    expect(within(item).getByText("연결된 과거 완료본이나 후속 요청이 없습니다.")).toBeTruthy();
  });

  it("copy, new tab and follow-up act on the latest completion", () => {
    const { item, props } = setup();
    fireEvent.click(within(item).getByRole("button", { name: "복사" }));
    expect(props.onCopy).toHaveBeenCalledWith(props.line);
    fireEvent.click(within(item).getByRole("button", { name: "새 탭" }));
    expect(props.onOpenContent).toHaveBeenCalledWith("REQ-2609-106", "C1");
    fireEvent.click(within(item).getByRole("button", { name: "후속 요청" }));
    expect(props.onFollowUp).toHaveBeenCalledWith(props.line);
  });

  it("hides copy for attachments and follow-up for non-requesters", () => {
    const withFile = line();
    withFile.latest.fileNames = ["약관.pdf"];
    const { item } = setup({ line: withFile, onFollowUp: undefined });
    expect(within(item).queryByRole("button", { name: "복사" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "후속 요청" })).toBeNull();
    expect(within(item).getByRole("button", { name: "새 탭" })).toBeTruthy();
  });
});
