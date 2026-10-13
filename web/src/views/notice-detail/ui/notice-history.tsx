"use client";

import { Fragment, useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelHeader, Table } from "@/shared/ui";
import { Button } from "@/shared/common";
import { RichTextView } from "@/shared/ui/rich-text";
import { NOTICE_SCOPE_LABEL, type NoticeLog } from "@/entities/notice";
import styles from "./notice-detail.module.css";

export interface NoticeHistoryProps {
  logs: NoticeLog[];
  userName: (id: number) => string;
  projectName: (id: number) => string | undefined;
}

/** 변경 이력: every 수정 / 철회 with the values before it (oldest first); the previous body opens in place. */
export function NoticeHistory({ logs, userName, projectName }: NoticeHistoryProps) {
  const [open, setOpen] = useState<number | null>(null);
  const scope = (l: NoticeLog) => {
    if (l.previousScope === null) return "-";
    const name = l.previousProjectId === null ? undefined : projectName(l.previousProjectId);
    return name ? `${NOTICE_SCOPE_LABEL[l.previousScope]}  ${name}` : NOTICE_SCOPE_LABEL[l.previousScope];
  };
  return (
    <Panel>
      <PanelHeader title="변경 이력" note="수정·철회 전의 범위, 제목, 내용을 보존합니다" />
      {logs.length === 0 ? (
        <Empty plain title="변경 이력이 없습니다" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>시각</th>
              <th>행위자</th>
              <th>작업</th>
              <th>이전 범위</th>
              <th>이전 제목</th>
              <th>이전 내용</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <Fragment key={i}>
                <tr>
                  <td className={styles.when}>{formatDateTime(l.at)}</td>
                  <td>{userName(l.actorId)}</td>
                  <td>{l.action}</td>
                  <td>{scope(l)}</td>
                  <td>{l.previousTitle ?? <span className={styles.faint}>-</span>}</td>
                  <td>
                    {l.previousBody === null ? (
                      <span className={styles.faint}>-</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={open === i}
                        onClick={() => setOpen(open === i ? null : i)}
                      >
                        {open === i ? "닫기" : "보기"}
                      </Button>
                    )}
                  </td>
                </tr>
                {open === i && l.previousBody !== null ? (
                  <tr>
                    <td colSpan={6} className={styles.previous}>
                      <RichTextView className={styles.body} value={l.previousBody} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
