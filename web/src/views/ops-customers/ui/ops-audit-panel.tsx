"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelHeader } from "@/shared/ui";
import { Button, DataTable, Select, type DataTableColumn } from "@/shared/common";
import type { AuditLog } from "@/entities/audit";
import { useOpsAuditLogs, type OpsCustomer } from "@/entities/ops";
import styles from "./ops-customers.module.css";

export interface OpsAuditPanelProps {
  /** Customers of the filter select; omitted with `customerId`. */
  customers?: Pick<OpsCustomer, "id" | "name">[];
  /** Fixed customer (detail page): no filter select. */
  customerId?: number;
}

const COLUMNS: DataTableColumn<AuditLog>[] = [
  { id: "at", name: "시각", width: "150px", cell: (a) => <span className={styles.when}>{formatDateTime(a.at)}</span> },
  { id: "actor", name: "행위자", width: "110px", cell: (a) => a.actorName ?? "시스템" },
  { id: "action", name: "행동", width: "150px", wrap: true, cell: (a) => a.action },
  { id: "target", name: "대상", width: "170px", wrap: true, cell: (a) => a.target },
  { id: "detail", name: "내용", grow: 1, minWidth: "220px", wrap: true, cell: (a) => <span className={styles.detail}>{a.detail}</span> },
];

/**
 * 운영 이력 (reference `OpsAuditTable`): every customer's audit trail and the operator records without a
 * customer, newest first, 20 per page (server paging); narrowed to one customer on demand or fixed to one.
 * Records have no detail, so rows do not open anything.
 */
export function OpsAuditPanel({ customers = [], customerId: fixed }: OpsAuditPanelProps) {
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const customerId = fixed ?? picked;
  const logs = useOpsAuditLogs({ customerId, page, size: LIST_PAGE_SIZE });

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
      {logs.isError ? (
        <Empty
          title="기록을 불러오지 못했습니다"
          description={logs.error.message}
          action={<Button onClick={() => void logs.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="운영 이력"
          columns={COLUMNS}
          data={logs.data?.content ?? []}
          loading={logs.isPending}
          page={logs.data ? { number: page, size: logs.data.page.size, totalElements: logs.data.page.totalElements } : undefined}
          onPage={setPage}
          empty={<Empty plain title="기록이 없습니다" description="고객사를 만들거나 설정을 바꾸면 여기에 남습니다." />}
        />
      )}
    </Panel>
  );
}
