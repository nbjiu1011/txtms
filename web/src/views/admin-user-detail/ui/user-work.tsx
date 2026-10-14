"use client";

import { Empty, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import { RequestStatusChip, type RequestSummary } from "@/entities/request";
import { useDeactivationImpact } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./user-detail.module.css";

export interface UserWorkProps {
  customerId: number;
  userId: number;
  openTab: WorkViewProps["openTab"];
}

/** A request in progress with the user's part in it. */
type WorkRow = RequestSummary & { part: "검수 중" | "요청 중" };

/**
 * 진행 업무 — reviews and own requests in progress and lead projects (the deactivation impact, contract §11). A row
 * opens the request.
 */
export function UserWork({ customerId, userId, openTab }: UserWorkProps) {
  const impact = useDeactivationImpact(customerId, userId);
  const open = (r: RequestSummary) => openTab({ route: "request", params: { id: r.id } });
  const columns: DataTableColumn<WorkRow>[] = [
    { id: "part", name: "구분", width: "88px", cell: (r) => r.part },
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="tabular">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: (r) => (
        <RowLink onClick={() => open(r)} label={`${r.id} ${r.title || "제목 없는 요청"} 열기`}>
          {r.title || "제목 없는 요청"}
        </RowLink>
      ),
    },
    { id: "status", name: "상태", width: "112px", cell: (r) => <RequestStatusChip status={r.status} /> },
  ];

  const data = impact.data;
  const rows: WorkRow[] = data
    ? [
        ...data.reviewing.map((r) => ({ ...r, part: "검수 중" as const })),
        ...data.requesting.map((r) => ({ ...r, part: "요청 중" as const })),
      ]
    : [];

  return (
    <Panel className={styles.block} aria-busy={impact.isFetching}>
      <PanelHeader title="진행 업무" note="비활성화나 역할 해제 전에 인수인계할 업무입니다" />
      {impact.isError ? (
        <Empty plain title="진행 업무를 불러오지 못했습니다" description={impact.error.message} />
      ) : (
        <>
          {data ? (
            <PanelBody className={styles.workSummary}>
              {`검수 중 ${data.reviewing.length}건 · 요청 중 ${data.requesting.length}건`}
              {data.leadProjects.length ? ` · 대표 검수자: ${data.leadProjects.map((p) => p.name).join(", ")}` : ""}
            </PanelBody>
          ) : null}
          <DataTable
            label="진행 업무"
            columns={columns}
            data={rows}
            onRowClick={open}
            loading={impact.isPending}
            empty={<Empty plain title="진행 중인 요청이 없습니다" />}
          />
        </>
      )}
    </Panel>
  );
}
