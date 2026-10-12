import type {
  AlimtalkPayload,
  BulkCommitRow,
  BulkImportRow,
  ContentType,
  SmsPayload,
} from "@/entities/request";

/** Content types that can be registered from XLSX. */
export const BULK_TYPES: readonly ContentType[] = ["ALIMTALK", "SMS"];

/** Template columns per type (first sheet row). */
export const BULK_COLUMNS: Partial<Record<ContentType, string>> = {
  ALIMTALK: "승인템플릿, 본문, 버튼명, 버튼링크",
  SMS: "발신자, 본문, 수신거부문구포함 (Y 또는 N)",
};

/** Preview table headers per type. */
export const BULK_HEADERS: Partial<Record<ContentType, string[]>> = {
  ALIMTALK: ["승인템플릿", "본문", "버튼명", "버튼링크"],
  SMS: ["발신자", "본문", "수신거부"],
};

export const BULK_MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Rows without errors are selected at first (reference `parseRows`). Channel spec warnings never
 * exclude a row (§17.3): a row with only warnings is valid.
 */
export function initialSelection(rows: readonly BulkImportRow[]): Set<number> {
  return new Set(rows.filter((r) => r.errors.length === 0).map((r) => r.rowNumber));
}

/** Toggles a row; rows with errors can never be selected. */
export function toggleRow(selection: ReadonlySet<number>, row: BulkImportRow): Set<number> {
  const next = new Set(selection);
  if (row.errors.length > 0) {
    next.delete(row.rowNumber);
    return next;
  }
  if (next.has(row.rowNumber)) next.delete(row.rowNumber);
  else next.add(row.rowNumber);
  return next;
}

/** Commit body rows: selected, error-free rows in sheet order. */
export function selectedRows(rows: readonly BulkImportRow[], selection: ReadonlySet<number>): BulkCommitRow[] {
  return rows
    .filter((r) => r.errors.length === 0 && selection.has(r.rowNumber))
    .map((r) => ({ title: r.title, payload: r.payload }));
}

export function previewSummary(rows: readonly BulkImportRow[]) {
  const excluded = rows.filter((r) => r.errors.length > 0).length;
  const warned = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length;
  return { total: rows.length, ok: rows.length - excluded, excluded, warned };
}

/** Sheet values of a preview row, rebuilt from the payload the row will become. */
export function previewCells(type: ContentType, row: BulkImportRow): string[] {
  if (type === "ALIMTALK") {
    const p = row.payload as AlimtalkPayload;
    const button = p.buttons?.[0];
    return [p.templateCode ?? "", p.body ?? "", button?.name ?? "", button?.link ?? ""];
  }
  const p = row.payload as SmsPayload;
  return [p.sender ?? "", p.body ?? "", p.optOut ? "Y" : "N"];
}
