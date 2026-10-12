"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, formatDateTime } from "@/shared/lib";
import { Button, Empty, Pager, Panel, PanelHeader, Select, Table } from "@/shared/ui";
import { useOpsAuditLogs, type OpsCustomer } from "@/entities/ops";
import styles from "./ops-customers.module.css";

export interface OpsAuditPanelProps {
  /** Customers of the filter select; omitted with `customerId`. */
  customers?: Pick<OpsCustomer, "id" | "name">[];
  /** Fixed customer (detail page): no filter select. */
  customerId?: number;
}

/**
 * 운영 이력 (reference `OpsAuditTable`): every customer's audit trail and the operator records without a
 * customer, newest first, 20 per page (server paging); narrowed to one customer on demand or fixed to one.
 */
export function OpsAuditPanel({ customers = [], customerId: fixed }: OpsAuditPanelProps) {
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const customerId = fixed ?? picked;
  const logs = useOpsAuditLogs({ customerId, page, size: LIST_PAGE_SIZE });
  const rows = logs.data?.content ?? [];

  return (
    <Panel className={styles.audit} aria-busy={logs.isFetching}>
      <PanelHeader title="운영 이력" note="접근과 반출은 업무 로그와 따로 보존합니다">
        {fixed === undefined ? (
          <Select
            aria-label="운영 이력 고객사"
            className={styles.filter}
            value={picked ?? ""}
            onChange={(e) => {
              setPage(0);
              setPicked(e.target.value ? Number(e.target.value) : null);
            }}
          >
            <option value="">전체 고객사</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : null}
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
