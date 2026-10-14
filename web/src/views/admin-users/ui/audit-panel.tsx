"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelHeader } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import { useCustomerAuditLogs, type AuditLog } from "@/entities/audit";

import styles from "./admin-users.module.css";

const PAGE_SIZE = 20;

const COLUMNS: DataTableColumn<AuditLog>[] = [
  { id: "at", name: "시각", width: "128px", cell: (a) => <span className={styles.when}>{formatDateTime(a.at)}</span> },
  { id: "actor", name: "행위자", width: "110px", cell: (a) => a.actorName ?? "시스템" },
  { id: "action", name: "행동", width: "160px", wrap: true, cell: (a) => a.action },
  { id: "target", name: "대상", width: "200px", wrap: true, cell: (a) => a.target },
  {
    id: "detail",
    name: "내용",
    grow: 1,
    minWidth: "200px",
    wrap: true,
    cell: (a) => <span className={styles.detail}>{a.detail}</span>,
  },
];

/** 접근·변경 기록 sub tab: the customer's audit log, newest first (`GET …/audit-logs`); records have no detail. */
export function AuditPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(0);
  const logs = useCustomerAuditLogs(customerId, page, PAGE_SIZE);
  return (
    <Panel aria-busy={logs.isFetching}>
      <PanelHeader title="접근·변경 기록" note="조회·반출과 관리 변경 기록입니다" />
      {logs.isError ? (
        <Empty
          title="기록을 불러오지 못했습니다"
          description={logs.error.message}
          action={<Button onClick={() => void logs.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="접근·변경 기록"
          columns={COLUMNS}
          data={logs.data?.content ?? []}
          loading={logs.isPending}
          page={
            logs.data ? { number: page, size: logs.data.page.size, totalElements: logs.data.page.totalElements } : undefined
          }
          onPage={setPage}
          empty={<Empty title="기록이 없습니다" description="조회·반출이나 관리 변경이 생기면 여기에 남습니다." />}
        />
      )}
    </Panel>
  );
}
