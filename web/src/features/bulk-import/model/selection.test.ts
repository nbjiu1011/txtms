import { describe, expect, it } from "vitest";
import type { BulkImportRow } from "@/entities/request";
import { initialSelection, previewCells, previewSummary, selectedRows, toggleRow } from "./selection";

const row = (rowNumber: number, errors: string[] = []): BulkImportRow => ({
  rowNumber,
  title: `대량 등록 ${rowNumber}행`,
  payload: { templateCode: "HB_POINT_01", body: `본문 ${rowNumber}`, buttons: [{ name: "보기", link: "https://x.kr" }] },
  errors,
});

const rows = [row(2), row(3, ["승인 템플릿 없음"]), row(5), row(6, ["본문 없음", "링크는 http 또는 https"])];

describe("bulk preview selection", () => {
  it("selects the error-free rows first", () => {
    expect([...initialSelection(rows)]).toEqual([2, 5]);
    expect(previewSummary(rows)).toEqual({ total: 4, ok: 2, excluded: 2 });
  });

  it("toggles valid rows and never selects error rows", () => {
    let sel = initialSelection(rows);
    sel = toggleRow(sel, rows[0]);
    expect(sel.has(2)).toBe(false);
    sel = toggleRow(sel, rows[1]);
    expect(sel.has(3)).toBe(false);
    sel = toggleRow(sel, rows[0]);
    expect(sel.has(2)).toBe(true);
  });

  it("commits only selected error-free rows in sheet order", () => {
    const sel = new Set([5, 3, 2]);
    expect(selectedRows(rows, sel).map((r) => r.title)).toEqual(["대량 등록 2행", "대량 등록 5행"]);
  });

  it("rebuilds sheet cells from the payload", () => {
    expect(previewCells("ALIMTALK", rows[0])).toEqual(["HB_POINT_01", "본문 2", "보기", "https://x.kr"]);
    const sms: BulkImportRow = {
      rowNumber: 2, title: "t", errors: [],
      payload: { sender: "1588-0000", body: "b", customerCenter: false, optOut: true },
    };
    expect(previewCells("SMS", sms)).toEqual(["1588-0000", "b", "Y"]);
  });
});
