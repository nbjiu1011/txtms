"use client";

import { useState } from "react";
import { downloadFile, isApiError } from "@/shared/api";
import { Icon, Panel, Table, toast } from "@/shared/ui";
import { Button, Modal, buttonClassName } from "@/shared/common";
import {
  CONTENT_TYPE_LABEL,
  requestApi,
  requestBinaryPaths,
  type BulkImportRow,
  type ContentType,
  type RequestDetail,
} from "@/entities/request";
import {
  BULK_COLUMNS,
  BULK_HEADERS,
  BULK_MAX_FILE_BYTES,
  initialSelection,
  previewCells,
  previewSummary,
  selectedRows,
  toggleRow,
} from "../model/selection";
import styles from "./bulk-import.module.css";

export interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  type: ContentType;
  /** Rows were added as new contents (the response detail and the number of rows). */
  onApplied: (detail: RequestDetail, count: number) => void;
}

function message(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

/**
 * XLSX 대량 등록 (알림톡·문자 drafts): template download, server preview with per-row errors
 * (error rows cannot be selected) and channel spec warnings (shown, the row stays selectable), then
 * the selected rows become new contents.
 */
export function BulkImportModal({ open, onClose, requestId, type, onApplied }: BulkImportModalProps) {
  const [rows, setRows] = useState<BulkImportRow[] | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState(false);
  const label = CONTENT_TYPE_LABEL[type];
  const close = () => {
    setRows(null);
    setSelection(new Set());
    onClose();
  };

  const readFile = async (file: File) => {
    if (file.size > BULK_MAX_FILE_BYTES) return toast("XLSX 최대 20MB");
    setReading(true);
    try {
      const preview = await requestApi.bulkPreview(requestId, file);
      setRows(preview.rows);
      setSelection(initialSelection(preview.rows));
    } catch (error) {
      toast(message(error, "파일을 읽지 못했습니다. XLSX 형식인지 확인하세요"));
    } finally {
      setReading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadFile(requestBinaryPaths.bulkTemplate(type), `${label}_등록양식.xlsx`);
    } catch (error) {
      toast(message(error, "템플릿을 내려받지 못했습니다"));
    }
  };

  const apply = async () => {
    const commit = selectedRows(rows ?? [], selection);
    try {
      const detail = await requestApi.bulkCommit(requestId, commit);
      toast(`${commit.length}행을 콘텐츠로 추가했습니다`);
      onApplied(detail, commit.length);
      setRows(null);
    } catch (error) {
      const details = isApiError(error) && error.details.length ? ` (${error.details.join(" / ")})` : "";
      toast(`${message(error, "행을 추가하지 못했습니다")}${details}`);
      return false;
    }
  };

  const summary = rows ? previewSummary(rows) : null;
  const headers = BULK_HEADERS[type] ?? [];

  return (
    <Modal
      open={open}
      onClose={close}
      title="XLSX 대량 등록"
      size="lg"
      okLabel="선택한 행 추가"
      okDisabled={selectedRows(rows ?? [], selection).length === 0}
      onOk={apply}
    >
      <p className={styles.intro}>
        {label} 열 구성: {BULK_COLUMNS[type]}. 첫 행은 머리글입니다.
      </p>
      <div className={styles.buttons}>
        <label className={buttonClassName()} aria-disabled={reading || undefined}>
          {reading ? "파일을 읽는 중" : "XLSX 파일 선택"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={styles.hidden}
            disabled={reading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </label>
        <Button variant="ghost" onClick={() => void downloadTemplate()}>
          <Icon name="down" />
          템플릿 받기
        </Button>
      </div>
      {rows && summary ? (
        <>
          <div className={styles.summary}>
            전체 {summary.total}행, 반영 가능 {summary.ok}행, 제외 {summary.excluded}행
            {summary.warned > 0 ? `, 규격 경고 ${summary.warned}행 (반영 가능)` : ""}
          </div>
          <Panel>
            <Table>
              <thead>
                <tr>
                  <th aria-label="선택" />
                  <th>행</th>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${row.rowNumber}행 선택`}
                        checked={selection.has(row.rowNumber)}
                        disabled={row.errors.length > 0}
                        onChange={() => setSelection((s) => toggleRow(s, row))}
                      />
                    </td>
                    <td>{row.rowNumber}</td>
                    {previewCells(type, row).map((v, i) => (
                      <td key={i} className={styles.cell}>
                        {v}
                      </td>
                    ))}
                    <td className={styles.result}>
                      {row.errors.length ? (
                        <span className={styles.error}>제외: {row.errors.join(", ")}</span>
                      ) : (
                        "반영 가능"
                      )}
                      {row.warnings.length ? (
                        <span className={styles.warning}>주의: {row.warnings.join(", ")}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </>
      ) : null}
    </Modal>
  );
}
