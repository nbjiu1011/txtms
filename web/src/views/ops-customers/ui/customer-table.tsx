import type { ReactNode } from "react";
import { Tag } from "@/shared/ui";
import { DataTable, RowLink, type DataTableColumn, type DataTablePage } from "@/shared/common";
import type { OpsCustomer } from "@/entities/ops";
import styles from "./ops-customers.module.css";

export interface CustomerTableProps {
  rows: OpsCustomer[];
  onOpen: (customer: OpsCustomer) => void;
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
}

/** 고객사 관리 list: a row click (or the name, by keyboard) opens the customer detail tab. */
export function CustomerTable({ rows, onOpen, page, onPage, loading, empty }: CustomerTableProps) {
  const columns: DataTableColumn<OpsCustomer>[] = [
    {
      id: "name",
      name: "고객사",
      grow: 1,
      minWidth: "200px",
      rowAction: true,
      cell: (c) => (
        <span>
          <RowLink onClick={() => onOpen(c)} label={`${c.name} 열기`}>
            {c.name}
          </RowLink>
          <span className={styles.domain}>{c.domain}</span>
        </span>
      ),
    },
    {
      id: "approval",
      name: "승인 단계",
      width: "128px",
      cell: (c) => (c.approvalEnabled ? <Tag variant="fill">승인 단계 사용</Tag> : <Tag>미사용</Tag>),
    },
    // plain-text cells: a click on the text itself opens the row (the library only counts clicks on the cell)
    { id: "projects", name: "프로젝트", width: "80px", cell: (c) => String(c.projectCount) },
    { id: "users", name: "사용자", width: "72px", cell: (c) => String(c.userCount) },
    {
      id: "admins",
      name: "고객사 관리자",
      width: "150px",
      wrap: true,
      cell: (c) => (c.admins.length ? c.admins.map((u) => u.name).join(", ") : <Tag variant="hot">미지정</Tag>),
    },
    {
      id: "active-requests",
      name: "진행 중 요청",
      width: "96px",
      cell: (c) => String(c.activeRequestCount),
    },
    {
      id: "datasets",
      name: "유효 데이터셋",
      width: "140px",
      cell: (c) =>
        c.unassignedDatasetTypes.length ? (
          <Tag variant="hot">{c.unassignedDatasetTypes.length}개 조합 미배정</Tag>
        ) : (
          <Tag>완료</Tag>
        ),
    },
    {
      id: "status",
      name: "상태",
      width: "80px",
      cell: (c) => (c.active ? <Tag>사용</Tag> : <Tag variant="hot">비활성</Tag>),
    },
  ];
  return (
    <DataTable
      label="고객사 목록"
      columns={columns}
      data={rows}
      onRowClick={onOpen}
      page={page}
      onPage={onPage}
      loading={loading}
      empty={empty}
    />
  );
}
