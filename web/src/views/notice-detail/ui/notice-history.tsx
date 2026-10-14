"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelHeader } from "@/shared/ui";
import { Button, DataTable, Modal, type DataTableColumn } from "@/shared/common";
import { RichTextView } from "@/shared/ui/rich-text";
import { NOTICE_SCOPE_LABEL, type NoticeLog } from "@/entities/notice";
import styles from "./notice-detail.module.css";

export interface NoticeHistoryProps {
  logs: NoticeLog[];
  userName: (id: number) => string;
  projectName: (id: number) => string | undefined;
}

/** A log with its position (logs have no id). */
type Row = NoticeLog & { id: number };

/** 변경 이력: every 수정 / 철회 with the values before it (oldest first); the previous body opens in a modal. */
export function NoticeHistory({ logs, userName, projectName }: NoticeHistoryProps) {
  const [open, setOpen] = useState<Row | null>(null);
  const scope = (l: NoticeLog) => {
    if (l.previousScope === null) return "-";
    const name = l.previousProjectId === null ? undefined : projectName(l.previousProjectId);
    return name ? `${NOTICE_SCOPE_LABEL[l.previousScope]}  ${name}` : NOTICE_SCOPE_LABEL[l.previousScope];
  };
  const columns: DataTableColumn<Row>[] = [
    { id: "at", name: "시각", width: "128px", cell: (l) => formatDateTime(l.at) },
    { id: "actor", name: "행위자", width: "110px", cell: (l) => userName(l.actorId) },
    { id: "action", name: "작업", width: "88px", cell: (l) => l.action },
    { id: "scope", name: "이전 범위", width: "180px", wrap: true, cell: scope },
    { id: "title", name: "이전 제목", grow: 1, minWidth: "180px", wrap: true, cell: (l) => l.previousTitle ?? "-" },
    {
      id: "body",
      name: "이전 내용",
      width: "96px",
      rowAction: true,
      cell: (l) =>
        l.previousBody === null ? (
          "-"
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setOpen(l)}>
            보기
          </Button>
        ),
    },
  ];
  return (
    <Panel>
      <PanelHeader title="변경 이력" note="수정·철회 전의 범위, 제목, 내용을 보존합니다" />
      <DataTable
        label="변경 이력"
        columns={columns}
        data={logs.map((l, i) => ({ ...l, id: i }))}
        empty={<Empty plain title="변경 이력이 없습니다" />}
      />
      {open && open.previousBody !== null ? (
        <Modal
          open
          onClose={() => setOpen(null)}
          title="이전 내용"
          description={`${formatDateTime(open.at)} ${open.action} 전 · ${open.previousTitle ?? ""}`}
          cancelLabel="닫기"
        >
          <RichTextView className={styles.body} value={open.previousBody} />
        </Modal>
      ) : null}
    </Panel>
  );
}
