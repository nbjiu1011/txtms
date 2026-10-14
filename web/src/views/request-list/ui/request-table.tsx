import type { ReactNode } from "react";
import { formatDate } from "@/shared/lib";
import { Avatar, AvatarStack, Tag } from "@/shared/ui";
import { DataTable, RowLink, type DataTableColumn, type DataTablePage } from "@/shared/common";
import { ContentTypeChip, RequestStatusChip, type RequestSummary } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./request-list.module.css";

export interface RequestTableProps {
  rows: RequestSummary[];
  users: UserDirectory;
  onOpen: (id: string) => void;
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
}

/** Request list: a row click (or the title, by keyboard) opens the request. */
export function RequestTable({ rows, users, onOpen, page, onPage, loading, empty }: RequestTableProps) {
  const columns: DataTableColumn<RequestSummary>[] = [
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="whitespace-nowrap text-sub">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "240px",
      rowAction: true,
      cell: (r) => (
        <span>
          <RowLink onClick={() => onOpen(r.id)} label={`${r.id} ${r.title || "제목 없는 요청"} 열기`}>
            {r.title || "제목 없는 요청"}
          </RowLink>
          {r.recallRequested ? (
            <>
              {" "}
              <Tag variant="recall">회수 요청됨</Tag>
            </>
          ) : null}
          {r.parentRequestId ? (
            <>
              {" "}
              <Tag>후속</Tag>
            </>
          ) : null}
        </span>
      ),
    },
    { id: "type", name: "유형", width: "100px", cell: (r) => <ContentTypeChip type={r.type} showLabel /> },
    { id: "status", name: "상태", width: "104px", cell: (r) => <RequestStatusChip status={r.status} /> },
    { id: "round", name: "차수", width: "56px", cell: (r) => `${r.round}차` },
    {
      id: "requester",
      name: "요청자",
      width: "112px",
      cell: (r) => {
        const requester = users.get(r.requesterId);
        return (
          <span className={styles.person}>
            <Avatar name={requester?.name ?? "-"} color={requester?.avatarColor} size={22} />
            {requester?.name ?? "-"}
          </span>
        );
      },
    },
    {
      id: "reviewers",
      name: "주담당 / 배정 검수자",
      width: "160px",
      cell: (r) => {
        if (r.primaryReviewerId === null) return <span className={styles.faint}>미배정</span>;
        const assigned = [r.primaryReviewerId, ...r.reviewerIds.filter((id) => id !== r.primaryReviewerId)];
        return (
          <span className={styles.person}>
            <AvatarStack people={assigned.map((id) => ({ name: users.name(id), color: users.get(id)?.avatarColor }))} />
            <b className={styles.primaryName}>{users.name(r.primaryReviewerId)}</b>
          </span>
        );
      },
    },
    {
      id: "due",
      name: "확정 납기",
      width: "140px",
      cell: (r) => (
        <span>
          {formatDate(r.dueDate)} {r.urgency === "URGENT" ? <Tag variant="hot">긴급</Tag> : null}{" "}
          {r.overdue ? <Tag variant="hot">지연</Tag> : null}
        </span>
      ),
    },
    { id: "submitted", name: "접수일", width: "84px", cell: (r) => formatDate(r.submittedAt) },
  ];
  return (
    <DataTable
      label="요청 목록"
      columns={columns}
      data={rows}
      onRowClick={(r) => onOpen(r.id)}
      page={page}
      onPage={onPage}
      loading={loading}
      empty={empty}
    />
  );
}
