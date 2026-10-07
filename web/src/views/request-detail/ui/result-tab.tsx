"use client";

import { useState } from "react";
import { downloadFile, http } from "@/shared/api";
import { formatDateTime, kstDateKey } from "@/shared/lib";
import { Button, Empty, Icon, Modal, PageHeader, Panel, PanelBody, PanelHeader, Table, tableClasses, toast } from "@/shared/ui";
import {
  CONTENT_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  VariableText,
  normalizePayload,
  requestFilePaths,
  resolveVariables,
  textFields,
  type BundleItem,
  type ContentType,
  type RcsPayload,
} from "@/entities/request";
import type { RequestPage } from "../model/use-request-page";
import styles from "./tabs.module.css";

type ExportKind = "xlsx" | "zip";

/** Message body text of a completed item (copy): 카드 본문 joined for RCS, `text` for 자유입력형. */
function bodyText(type: ContentType, item: BundleItem): string {
  const p = normalizePayload(type, item.payload);
  if (type === "RCS") return (p as RcsPayload).cards.map((c) => c.body).join("\n");
  if ("body" in p) return p.body;
  return "text" in p ? p.text : "";
}

/** 완료 결과 sub tab — frozen completion bundle (reference `vResult`). */
export function ResultTab({ page }: { page: RequestPage }) {
  const { request: r, users, variableValues } = page;
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const bundle = r.bundle;
  if (!bundle) return <Empty title="완료 묶음이 없습니다" />;
  const hasFiles = bundle.items.some((i) => i.files.length > 0);

  const runExport = async (kind: ExportKind) => {
    const path = kind === "xlsx" ? requestFilePaths.bundleXlsx(r.id) : requestFilePaths.bundleZip(r.id);
    const name = kind === "xlsx" ? `${r.id}_완료본.xlsx` : `${r.id}_첨부_완료본.zip`;
    try {
      await downloadFile(path, name);
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : "파일을 내려받지 못했습니다");
      return false;
    }
    return undefined;
  };

  const copy = async (item: BundleItem) => {
    try {
      await navigator.clipboard.writeText(resolveVariables(bodyText(r.type, item), variableValues));
    } catch {
      toast("복사하지 못했습니다. 직접 선택해 복사하세요");
      return;
    }
    toast("문안을 복사했습니다");
    // Export audit (완료본 반출). The copy itself already happened; an audit failure is reported.
    http.post(`/requests/${encodeURIComponent(r.id)}/bundle/copy-events`, { contentKey: item.contentKey }).catch(() => {
      console.warn("[txtms] copy audit event was not recorded (endpoint unavailable)");
    });
  };

  return (
    <>
      <PageHeader
        className={styles.resultHead}
        title="완료 묶음"
        description={`${REQUEST_STATUS_LABEL[bundle.status]}  ${formatDateTime(bundle.completedAt)}  처리 ${users.name(bundle.completedBy)}  콘텐츠 ${bundle.items.length}건`}
        actions={
          <>
            <Button onClick={() => setExporting("xlsx")}>
              <Icon name="down" />
              요청 전체 XLSX 반출
            </Button>
            {hasFiles ? (
              <Button onClick={() => setExporting("zip")}>
                <Icon name="down" />
                첨부 최종본 묶음
              </Button>
            ) : null}
          </>
        }
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>콘텐츠</th>
              <th>유형</th>
              <th>본문</th>
              <th>완료 버전</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bundle.items.map((item) => (
              <tr key={item.contentKey}>
                <td className={tableClasses.ttl}>
                  {item.contentKey} {item.title}
                </td>
                <td>{CONTENT_TYPE_LABEL[r.type]}</td>
                <td className={styles.body}>
                  {item.files.length ? (
                    item.files.map((f, i) => (
                      <span key={f.id}>
                        {i > 0 ? <br /> : null}
                        {f.name} (v{f.version})
                      </span>
                    ))
                  ) : (
                    <VariableText
                      text={textFields(r.type, item.payload)
                        .map(([, v]) => v)
                        .filter(Boolean)
                        .join("\n")}
                    />
                  )}
                </td>
                <td>v{item.version}</td>
                <td>
                  <div className={styles.rowBtns}>
                    {item.files.length ? null : (
                      <Button size="sm" onClick={() => void copy(item)}>
                        <Icon name="copy" />
                        복사
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel className={styles.varsPanel}>
        <PanelHeader title="완료 당시 변수 값" />
        <PanelBody>
          {bundle.variables.length
            ? bundle.variables.map((v) => (
                <div key={v.key}>
                  {v.key} = {v.value}
                </div>
              ))
            : "변수 없음"}
        </PanelBody>
      </Panel>
      <Modal
        open={exporting === "xlsx"}
        title="요청 전체 XLSX 반출"
        okLabel="파일 받기"
        onClose={() => setExporting(null)}
        onOk={() => runExport("xlsx")}
      >
        <p>
          {r.title} · 콘텐츠 {bundle.items.length}건 · {kstDateKey(bundle.completedAt)} (KST)
        </p>
      </Modal>
      <Modal
        open={exporting === "zip"}
        title="첨부 최종본 ZIP"
        okLabel="묶음 받기"
        onClose={() => setExporting(null)}
        onOk={() => runExport("zip")}
      >
        <p>최종 파일과 완료 버전 명세를 함께 다운로드합니다.</p>
      </Modal>
    </>
  );
}
