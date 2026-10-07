import { Fragment } from "react";
import { Avatar, Bar, Empty, Table, Tag } from "@/shared/ui";
import type { WorkloadRow } from "@/entities/dashboard";
import { FILE_UNIT_LABEL } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./workload-table.module.css";

const COLUMNS = ["검수자", "활성 요청", "주담당", "납기 임박·지연", "문안 글자 수", "파일 실제 검수 범위"];

export interface WorkloadTableProps {
  rows: WorkloadRow[];
  users: UserDirectory;
}

/** 검수자별 업무량 table (reference `workloadRows`): counts, characters, file ranges per unit, load bar. */
export function WorkloadTable({ rows, users }: WorkloadTableProps) {
  const max = Math.max(1, ...rows.map((r) => r.active));
  return (
    <>
      <Table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th className={styles.loadCol}>부하</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const user = users.get(row.userId);
            const name = user?.name ?? "-";
            return (
              <tr key={row.userId}>
                <td>
                  <span className={styles.person}>
                    <Avatar name={name} color={user?.avatarColor} size={22} />
                    {name}
                  </span>
                </td>
                <td>{row.active}</td>
                <td>{row.primary}</td>
                <td>{row.dueSoonOrOverdue}</td>
                <td>{row.chars.toLocaleString("ko-KR")}자</td>
                <td>
                  {row.files.length ? (
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
                  )}
                </td>
                <td>
                  <Bar percent={(row.active / max) * 100} label={`${name} 부하`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {rows.length === 0 ? <Empty plain title="검수자가 없습니다" /> : null}
      <p className={styles.note}>
        파일 검수량은 파일 건수가 아니라 실제 검수 범위로 표시하며, 단위가 다르면 합산하지 않습니다.
      </p>
    </>
  );
}
