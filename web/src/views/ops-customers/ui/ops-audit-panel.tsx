"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, Empty, Pager, Panel, PanelHeader, Select, Table } from "@/shared/ui";
import { useOpsAuditLogs, type OpsCustomer } from "@/entities/ops";
import styles from "./ops-customers.module.css";

const PAGE_SIZE = 12;

export interface OpsAuditPanelProps {
  customers: OpsCustomer[];
}

/**
 * 운영 이력 (reference `OpsAuditTable`): every customer's audit trail and the operator records without a
 * customer, newest first, 12 per page like the reference; narrowed to one customer on demand.
 */
export function OpsAuditPanel({ customers }: OpsAuditPanelProps) {
  const [page, setPage] = useState(0);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const logs = useOpsAuditLogs({ customerId, page, size: PAGE_SIZE });
  const rows = logs.data?.content ?? [];

  return (
    <Panel className={styles.audit} aria-busy={logs.isFetching}>
      <PanelHeader title="운영 이력" note="접근과 반출은 업무 로그와 따로 보존합니다">
        <Select
          aria-label="운영 이력 고객사"
          className={styles.filter}
          value={customerId ?? ""}
          onChange={(e) => {
            setPage(0);
            setCustomerId(e.target.value ? Number(e.target.value) : null);
          }}
        >
          <option value="">전체 고객사</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </PanelHeader>
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.when}>{formatDateTime(a.at)}</td>
                    <td>{a.actorName ?? "시스템"}</td>
                    <td>{a.action}</td>
                    <td>{a.target}</td>
                    <td className={styles.detail}>{a.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pager page={page} totalPages={logs.data.page.totalPages} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
