import type { ReactNode } from "react";
import { Tag } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn, type DataTablePage } from "@/shared/common";
import type { Project } from "@/entities/project";
import type { UserDirectory } from "@/entities/user";
import styles from "./admin-projects.module.css";

export interface ProjectTableProps {
  rows: Project[];
  users: UserDirectory;
  approvalEnabled: boolean;
  /** Row click (or the name, by keyboard): 프로젝트 정보 with every action. */
  onOpen: (project: Project) => void;
  /** The one row action: 구성원. */
  onMembers: (project: Project) => void;
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
}

/** Projects of the customer: name, lead, approvers, members, requests in progress, state, and 구성원. */
export function ProjectTable({ rows, users, approvalEnabled, onOpen, onMembers, ...table }: ProjectTableProps) {
  const columns: DataTableColumn<Project>[] = [
    {
      id: "name",
      name: "프로젝트",
      grow: 1,
      minWidth: "200px",
      rowAction: true,
      cell: (p) => (
        <RowLink onClick={() => onOpen(p)} label={`${p.name} 정보`}>
          {p.name}
        </RowLink>
      ),
    },
    { id: "lead", name: "대표 검수자", width: "120px", cell: (p) => users.name(p.leadUserId) },
    {
      id: "approvers",
      name: "승인자",
      width: "180px",
      wrap: true,
      cell: (p) =>
        approvalEnabled
          ? p.members
              .filter((m) => m.roles.includes("APPROVER"))
              .map((m) => users.name(m.userId))
              .join(", ") || "-"
          : <span className={styles.faint}>승인 단계 미사용</span>,
    },
    { id: "members", name: "구성원", width: "80px", cell: (p) => `${p.members.length}명` },
    // 진행 중 요청 = submitted and not final, counted by the server for the customer admin (§14.6)
    { id: "active", name: "진행 중 요청", width: "104px", cell: (p) => p.activeRequestCount ?? "-" },
    {
      id: "state",
      name: "상태",
      width: "80px",
      cell: (p) => (p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>),
    },
    {
      id: "actions",
      name: "",
      width: "96px",
      rowAction: true,
      cell: (p) => (
        <Button size="sm" onClick={() => onMembers(p)}>
          구성원
        </Button>
      ),
    },
  ];
  return <DataTable label="프로젝트 목록" columns={columns} data={rows} onRowClick={onOpen} {...table} />;
}
