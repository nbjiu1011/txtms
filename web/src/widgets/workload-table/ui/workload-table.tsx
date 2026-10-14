import { Fragment } from "react";
import { Avatar, Bar, Empty, Tag } from "@/shared/ui";
import { DataTable, type DataTableColumn } from "@/shared/common";
import type { WorkloadRow } from "@/entities/dashboard";
import { FILE_UNIT_LABEL } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./workload-table.module.css";

export interface WorkloadTableProps {
  rows: WorkloadRow[];
  users: UserDirectory;
}

/** 검수자별 업무량 table (reference `workloadRows`): counts, characters, file ranges per unit, load bar. No row click. */
export function WorkloadTable({ rows, users }: WorkloadTableProps) {
  const max = Math.max(1, ...rows.map((r) => r.active));
  const name = (row: WorkloadRow) => users.get(row.userId)?.name ?? "-";
  const columns: DataTableColumn<WorkloadRow>[] = [
    {
      id: "reviewer",
      name: "검수자",
      width: "132px",
      cell: (row) => (
        <span className={styles.person}>
          <Avatar name={name(row)} color={users.get(row.userId)?.avatarColor} size={22} />
          {name(row)}
        </span>
      ),
    },
    { id: "active", name: "활성 요청", width: "84px", cell: (row) => row.active },
    { id: "primary", name: "주담당", width: "72px", cell: (row) => row.primary },
    { id: "due", name: "납기 임박·지연", width: "112px", cell: (row) => row.dueSoonOrOverdue },
    { id: "chars", name: "문안 글자 수", width: "108px", cell: (row) => `${row.chars.toLocaleString("ko-KR")}자` },
    {
      id: "files",
      name: "파일 실제 검수 범위",
      width: "180px",
      wrap: true,
      cell: (row) =>
        row.files.length ? (
          row.files.map((f, i) => (
            <Fragment key={f.unit}>
              {i > 0 ? " " : null}
              <Tag>
                {FILE_UNIT_LABEL[f.unit]} {f.amount}
              </Tag>
            </Fragment>
          ))
        ) : (
          <span className={styles.faint}>-</span>
        ),
    },
    {
      id: "load",
      name: "부하",
      grow: 1,
      minWidth: "160px",
      cell: (row) => (
        <span className={styles.load}>
          <Bar percent={(row.active / max) * 100} label={`${name(row)} 부하`} />
        </span>
      ),
    },
  ];
  return (
    <>
      <DataTable
        label="검수자별 업무량"
        columns={columns}
        data={rows}
        keyField="userId"
        empty={<Empty plain title="검수자가 없습니다" description="프로젝트에 검수자를 추가하면 업무량이 표시됩니다." />}
      />
      <p className={styles.note}>
        파일 검수량은 파일 건수가 아니라 실제 검수 범위로 표시하며, 단위가 다르면 합산하지 않습니다.
      </p>
    </>
  );
}
