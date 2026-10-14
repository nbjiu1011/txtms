import type { ReactNode } from "react";
import { Avatar, Tag } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn, type DataTablePage } from "@/shared/common";
import type { Project } from "@/entities/project";
import type { Member } from "@/entities/user";
import { memberRoleText } from "../model/member-rows";
import styles from "./admin-users.module.css";

export interface UsersTableProps {
  members: Member[];
  projects: Project[];
  busyId: number | null;
  /** Opens the user's detail tab (사용자 상세: 이메일 변경, 비활성화/재활성화 and the rest). */
  onOpen: (m: Member) => void;
  /** The row action of an accepted user. */
  onRoles: (m: Member) => void;
  /** The row action of an invited user who has not accepted yet. */
  onReissue: (m: Member) => void;
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
}

/** Members have no top-level id: rows are keyed by the user id. */
interface Row {
  id: number;
  m: Member;
}

function statusTag({ m }: Row) {
  if (m.pending) return <Tag variant="fill">초대 대기</Tag>;
  return m.user.active ? <Tag>활성</Tag> : <Tag variant="hot">비활성</Tag>;
}

/**
 * 사용자와 역할 (reference `vUsers` + J:146 pending rows): a row opens 사용자 상세; the one row action is 역할, or
 * 초대 재발급 for an invitation not accepted yet.
 */
export function UsersTable({ members, projects, busyId, onOpen, onRoles, onReissue, ...table }: UsersTableProps) {
  const columns: DataTableColumn<Row>[] = [
    {
      id: "user",
      name: "사용자",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: ({ m }) => (
        <span className={styles.user}>
          <Avatar name={m.user.name} color={m.user.avatarColor} size={24} />
          <span>
            <RowLink onClick={() => onOpen(m)} label={`${m.user.name} 상세 보기`}>
              {m.user.name}
            </RowLink>
            <br />
            <span className={styles.email}>{m.user.email}</span>
            {m.pendingEmail ? (
              <>
                <br />
                <span className={styles.email}>변경 확인 대기: {m.pendingEmail}</span>
              </>
            ) : null}
          </span>
        </span>
      ),
    },
    // reference: an invited user without a department reads 초대 대기
    {
      id: "dept",
      name: "소속",
      width: "120px",
      wrap: true,
      cell: ({ m }) => m.user.dept ?? (m.pending ? "초대 대기" : ""),
    },
    {
      id: "admin",
      name: "관리 권한",
      width: "120px",
      cell: ({ m }) => (m.admin ? <Tag variant="fill">고객사 관리자</Tag> : <span className={styles.faint}>-</span>),
    },
    ...projects.map(
      (p): DataTableColumn<Row> => ({
        id: `project-${p.id}`,
        name: p.name,
        width: "120px",
        wrap: true,
        cell: ({ m }) => (
          <span className={styles.small}>{memberRoleText(m, p.id) ?? <span className={styles.faint}>-</span>}</span>
        ),
      }),
    ),
    { id: "state", name: "상태", width: "92px", cell: statusTag },
    {
      id: "action",
      name: "",
      width: "112px",
      rowAction: true,
      cell: ({ m }) =>
        m.pending ? (
          <Button size="sm" disabled={busyId === m.user.id} onClick={() => onReissue(m)}>
            초대 재발급
          </Button>
        ) : (
          <Button size="sm" onClick={() => onRoles(m)} aria-label={`${m.user.name} 역할`}>
            역할
          </Button>
        ),
    },
  ];
  return (
    <DataTable
      label="사용자와 역할"
      columns={columns}
      data={members.map((m) => ({ id: m.user.id, m }))}
      onRowClick={(r) => onOpen(r.m)}
      {...table}
    />
  );
}
