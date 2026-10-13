"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Icon, PageHeader, Panel, PanelBody, PanelHeader, Table, tableClasses } from "@/shared/ui";
import { Button } from "@/shared/common";
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
  /** 후속 요청 of one completed item (`FOLLOW_UP`). */
  onFollowUp: (contentKey: string) => void;
}

/**
 * 완료 결과 sub tab — the frozen completion bundle (reference `vResult`): items with their final
 * version, 복사 (body with completion-time variable values), XLSX / ZIP export and 후속 요청 per item.
 */
export function ResultTab({ page, performable, onFollowUp }: ResultTabProps) {
  const { request: r, users } = page;
  const [exporting, setExporting] = useState<BundleExportKind | null>(null);
  const bundle = r.bundle;
  if (!bundle) return <Empty title="완료 묶음이 없습니다" />;
  const hasFiles = bundle.items.some((i) => i.files.length > 0);
  const canExport = performable.has("EXPORT");
  const canFollowUp = performable.has("FOLLOW_UP");

  const copy = (item: BundleItem) =>
    void copyCompletedText({
      requestId: r.id,
      contentKey: item.contentKey,
      text: completedCopyText(r.type, item, bundle.variables),
    });

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
                      <Button size="sm" aria-label={`${item.contentKey} 문안 복사`} onClick={() => copy(item)}>
                        <Icon name="copy" />
                        복사
                      </Button>
                    )}
                    {canFollowUp ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${item.contentKey} 후속 요청`}
                        onClick={() => onFollowUp(item.contentKey)}
                      >
                        후속 요청
                      </Button>
                    ) : null}
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
