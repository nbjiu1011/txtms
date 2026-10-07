"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, Empty, Pager, Panel, PanelHeader, Table } from "@/shared/ui";
import { useCustomerAuditLogs } from "@/entities/audit";

import styles from "./admin-users.module.css";

const PAGE_SIZE = 20;

/** 접근·변경 기록 sub tab: the customer's audit log, newest first (`GET …/audit-logs`). */
export function AuditPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(0);
  const logs = useCustomerAuditLogs(customerId, page, PAGE_SIZE);
  return (
    <Panel aria-busy={logs.isFetching}>
      <PanelHeader title="접근·변경 기록" note="조회·반출과 관리 변경 기록입니다" />
      {logs.isPending ? (
        <Empty plain title="기록을 불러오는 중입니다" />
      ) : logs.isError ? (
        <Empty
          title="기록을 불러오지 못했습니다"
          description={logs.error.message}
          action={<Button onClick={() => void logs.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>시각</th>
                <th>행위자</th>
                <th>행동</th>
                <th>대상</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.content.map((a) => (
                <tr key={a.id}>
                  <td className={styles.when}>{formatDateTime(a.at)}</td>
                  <td>{a.actorName ?? "시스템"}</td>
                  <td>{a.action}</td>
                  <td>{a.target}</td>
                  <td className={styles.detail}>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {logs.data.content.length === 0 ? <Empty title="기록이 없습니다" /> : null}
          <Pager page={page} totalPages={logs.data.page.totalPages} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
