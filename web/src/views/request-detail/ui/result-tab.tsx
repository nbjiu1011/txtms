"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Icon, PageHeader, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import {
  CONTENT_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  VariableText,
  completedCopyText,
  textFields,
  type BundleItem,
  type RequestAction,
} from "@/entities/request";
import { BundleExportDialog, copyCompletedText, type BundleExportKind } from "@/features/completed-output";
import type { RequestPage } from "../model/use-request-page";
import styles from "./tabs.module.css";

export interface ResultTabProps {
  page: RequestPage;
  performable: ReadonlySet<RequestAction>;
  /** Row click: the item's content tab (where 후속 요청 of that content is written). */
  onOpenContent: (contentKey: string) => void;
}

/**
 * 완료 결과 sub tab — the frozen completion bundle (reference `vResult`): items with their final
 * version, 복사 (body with completion-time variable values) as the one row action, and XLSX / ZIP export.
 * A row opens the content; 후속 요청 is in the content tab and the request header.
 */
export function ResultTab({ page, performable, onOpenContent }: ResultTabProps) {
  const { request: r, users } = page;
  const [exporting, setExporting] = useState<BundleExportKind | null>(null);
  const bundle = r.bundle;
  if (!bundle) return <Empty title="완료 묶음이 없습니다" />;
  const hasFiles = bundle.items.some((i) => i.files.length > 0);
  const canExport = performable.has("EXPORT");

  const copy = (item: BundleItem) =>
    void copyCompletedText({
      requestId: r.id,
      contentKey: item.contentKey,
      text: completedCopyText(r.type, item, bundle.variables),
    });

  const columns: DataTableColumn<BundleItem>[] = [
    {
      id: "content",
      name: "콘텐츠",
      width: "220px",
      rowAction: true,
      cell: (item) => (
        <RowLink onClick={() => onOpenContent(item.contentKey)} label={`${item.contentKey} ${item.title} 열기`}>
          {item.contentKey} {item.title}
        </RowLink>
      ),
    },
    { id: "type", name: "유형", width: "88px", cell: () => CONTENT_TYPE_LABEL[r.type] },
    {
      id: "body",
      name: "본문",
      grow: 1,
      minWidth: "240px",
      wrap: true,
      cell: (item) => (
        <div className={styles.body}>
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
        </div>
      ),
    },
    { id: "version", name: "완료 버전", width: "84px", cell: (item) => `v${item.version}` },
    {
      id: "copy",
      name: "복사",
      width: "92px",
      rowAction: true,
      cell: (item) =>
        item.files.length ? null : (
          <Button size="sm" aria-label={`${item.contentKey} 문안 복사`} onClick={() => copy(item)}>
            <Icon name="copy" />
            복사
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        className={styles.resultHead}
        title="완료 묶음"
        description={`${REQUEST_STATUS_LABEL[bundle.status]}  ${formatDateTime(bundle.completedAt)}  처리 ${users.name(bundle.completedBy)}  콘텐츠 ${bundle.items.length}건`}
        actions={
          canExport ? (
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
          ) : undefined
        }
      />
      <Panel>
        <DataTable
          label="완료 콘텐츠"
          columns={columns}
          data={bundle.items}
          keyField="contentKey"
          onRowClick={(item) => onOpenContent(item.contentKey)}
        />
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
      <BundleExportDialog
        kind={exporting}
        requestId={r.id}
        requestTitle={r.title}
        itemCount={bundle.items.length}
        completedAt={bundle.completedAt}
        onClose={() => setExporting(null)}
      />
    </>
  );
}
