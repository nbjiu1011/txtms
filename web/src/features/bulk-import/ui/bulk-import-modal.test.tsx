import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestApi, type BulkImportRow, type RequestDetail } from "@/entities/request";
import { BulkImportModal } from "./bulk-import-modal";

const row = (rowNumber: number, errors: string[], warnings: string[]): BulkImportRow => ({
  rowNumber,
  title: `대량 등록 ${rowNumber}행`,
  payload: { templateCode: "HB_POINT_01", body: `본문 ${rowNumber}`, buttons: [] },
  errors,
  warnings,
});

const ROWS = [
  row(2, [], []),
  row(3, [], ["본문 1,000자 초과 (1,001자)"]),
  row(4, ["승인 템플릿 없음"], ["버튼명 14자 초과 (아주 긴 버튼 이름입니다만)"]),
];

describe("BulkImportModal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps rows with only channel spec warnings selectable and shows warnings apart from errors", async () => {
    vi.spyOn(requestApi, "bulkPreview").mockResolvedValue({ rows: ROWS, limit: 1000 });
    const commit = vi.spyOn(requestApi, "bulkCommit").mockResolvedValue({} as RequestDetail);
    const onApplied = vi.fn();
    render(<BulkImportModal open onClose={vi.fn()} requestId="REQ-T" type="ALIMTALK" onApplied={onApplied} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "rows.xlsx")] } });

    const warned = (await screen.findByRole("checkbox", { name: "3행 선택" })) as HTMLInputElement;
    expect(warned.disabled).toBe(false);
    expect(warned.checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "4행 선택" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("전체 3행, 반영 가능 2행, 제외 1행, 규격 경고 1행 (반영 가능)")).toBeTruthy();

    const cells = screen.getAllByRole("row").map((r) => r.lastElementChild?.textContent);
    expect(cells.slice(1)).toEqual([
      "반영 가능",
      "반영 가능주의: 본문 1,000자 초과 (1,001자)",
      "제외: 승인 템플릿 없음주의: 버튼명 14자 초과 (아주 긴 버튼 이름입니다만)",
    ]);

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "선택한 행 추가" }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(commit.mock.calls[0][1].map((r) => r.title)).toEqual(["대량 등록 2행", "대량 등록 3행"]);
  });
});
