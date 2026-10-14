"use client";

import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Panel, Tag } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import { RequestStatusChip, useRequests } from "@/entities/request";
import { toMyReviewRow, type MineFilter, type MyReviewRow } from "../model/review-rows";
import styles from "./review.module.css";

export interface MyReviewTableProps {
  projectId: number;
  meId: number;
  filter: MineFilter;
  onOpen: (id: string) => void;
}

/** 내 검수 — requests I am assigned to (진행 중 = not final, 완료 = final), 20 per page; a row opens the request. */
export function MyReviewTable({ projectId, meId, filter, onOpen }: MyReviewTableProps) {
  const [page, setPage] = useListPage(`${projectId}:${filter}`);
  const list = useRequests({
    projectId,
    view: filter === "active" ? "MY_ASSIGNED_ACTIVE" : "MY_ASSIGNED_DONE",
    page,
    size: LIST_PAGE_SIZE,
  });
  useClampPage(page, list.isPlaceholderData ? undefined : list.data?.page.totalPages, setPage);
  const rows = (list.data?.content ?? []).map((r) => toMyReviewRow(r, meId));

  const columns: DataTableColumn<MyReviewRow>[] = [
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="whitespace-nowrap text-sub">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: (r) => (
        <span>
          <RowLink onClick={() => onOpen(r.id)} label={`${r.id} ${r.title} 열기`}>
            {r.title}
          </RowLink>
          {r.recall ? (
            <>
              {" "}
              <Tag variant="recall">회수 요청됨</Tag>
            </>
          ) : null}
        </span>
      ),
    },
    { id: "status", name: "상태", width: "104px", cell: (r) => <RequestStatusChip status={r.status} /> },
    {
      id: "role",
      name: "내 역할",
      width: "88px",
      cell: (r) => (r.role === "주담당" ? <b className={styles.primary}>주담당</b> : "공동 검수"),
    },
    { id: "round", name: "차수", width: "64px", cell: (r) => r.round },
    { id: "volume", name: "검수량", width: "140px", cell: (r) => r.volume },
    {
      id: "due",
      name: "확정 납기",
      width: "128px",
      cell: (r) => (
        <span>
          {r.due} {r.dueTag ? <Tag variant="hot">{r.dueTag}</Tag> : null}
        </span>
      ),
    },
  ];

  return (
    <Panel aria-busy={list.isFetching}>
      {list.isError ? (
        <Empty
          title="검수 요청을 불러오지 못했습니다"
          description={list.error.message}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="내 검수"
          columns={columns}
          data={rows}
          onRowClick={(r) => onOpen(r.id)}
          loading={list.isPending}
          page={list.data ? { number: page, size: list.data.page.size, totalElements: list.data.page.totalElements } : undefined}
          onPage={setPage}
          empty={
            <Empty
              title="해당하는 검수 요청이 없습니다"
              description={
                filter === "active"
                  ? "배정된 요청이 생기면 여기에 표시됩니다. 끝난 요청은 '완료'에서 볼 수 있습니다."
                  : "검수를 마친 요청이 여기에 쌓입니다."
              }
            />
          }
        />
      )}
    </Panel>
  );
}
