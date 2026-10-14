"use client";

import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Panel, PanelHeader } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import { RequestStatusChip, useRequests, type RequestListView } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import { toAssignQueueRow, type AssignQueueRow } from "../model/review-rows";
import styles from "./review.module.css";

export interface AssignQueueProps {
  title: string;
  view: RequestListView;
  projectId: number;
  users: UserDirectory;
  onOpen: (id: string) => void;
  /** 배정 대기 only: the one row action (opens the request with the assignment modal). */
  onAssign?: (id: string) => void;
  /** Shown when the queue is empty. */
  emptyText: string;
}

/** One 배정 관리 queue, 20 per page (the header counts the whole queue); a row click opens the request. */
export function AssignQueue({ title, view, projectId, users, onOpen, onAssign, emptyText }: AssignQueueProps) {
  const [page, setPage] = useListPage(`${projectId}:${view}`);
  const list = useRequests({ projectId, view, page, size: LIST_PAGE_SIZE });
  useClampPage(page, list.isPlaceholderData ? undefined : list.data?.page.totalPages, setPage);
  const rows = (list.data?.content ?? []).map(toAssignQueueRow);
  const total = list.data?.page.totalElements ?? 0;

  const columns: DataTableColumn<AssignQueueRow>[] = [
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="whitespace-nowrap text-sub">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "200px",
      rowAction: true,
      cell: (r) => (
        <RowLink onClick={() => onOpen(r.id)} label={`${r.id} ${r.title} 열기`}>
          {r.title}
        </RowLink>
      ),
    },
    { id: "status", name: "상태", width: "104px", cell: (r) => <RequestStatusChip status={r.status} /> },
    { id: "requester", name: "요청자", width: "96px", cell: (r) => users.name(r.requesterId) },
    { id: "hope", name: "희망 납기", width: "96px", cell: (r) => r.hope },
    { id: "due", name: "확정 납기", width: "96px", cell: (r) => r.due },
    { id: "urgency", name: "긴급도", width: "72px", cell: (r) => r.urgency },
    onAssign
      ? {
          id: "assign",
          name: "배정",
          width: "84px",
          rowAction: true,
          cell: (r) => (
            <Button size="sm" variant="pri" onClick={() => onAssign(r.id)} aria-label={`${r.id} 배정`}>
              배정
            </Button>
          ),
        }
      : {
          id: "reviewers",
          name: "검수자",
          width: "160px",
          cell: (r) =>
            r.reviewerIds.length > 0 ? (
              r.reviewerIds.map((id) => users.name(id)).join(", ")
            ) : (
              <span className={styles.faint}>미배정</span>
            ),
        },
  ];

  return (
    <Panel aria-label={title} aria-busy={list.isFetching} className={styles.queue}>
      <PanelHeader title={title} note={`${total}건`} />
      {list.isError ? (
        <div className={styles.none}>
          불러오지 못했습니다{" "}
          <Button size="sm" onClick={() => void list.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <DataTable
          label={title}
          columns={columns}
          data={rows}
          onRowClick={(r) => onOpen(r.id)}
          loading={list.isPending}
          page={list.data ? { number: page, size: list.data.page.size, totalElements: total } : undefined}
          onPage={setPage}
          empty={<div className={styles.none}>{emptyText}</div>}
        />
      )}
    </Panel>
  );
}
