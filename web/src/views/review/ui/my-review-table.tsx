"use client";

import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Panel, Table, Tag, tableClasses } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { RequestStatusChip, useRequests } from "@/entities/request";
import { toMyReviewRow, type MineFilter } from "../model/review-rows";
import styles from "./review.module.css";

const COLUMNS = ["요청 ID", "제목", "상태", "내 역할", "차수", "검수량", "확정 납기"];

export interface MyReviewTableProps {
  projectId: number;
  meId: number;
  filter: MineFilter;
  onOpen: (id: string) => void;
}

/** 내 검수 — requests I am assigned to (진행 중 = not final, 완료 = final), 20 per page. */
export function MyReviewTable({ projectId, meId, filter, onOpen }: MyReviewTableProps) {
  const [page, setPage] = useListPage(`${projectId}:${filter}`);
  const list = useRequests({
    projectId,
    view: filter === "active" ? "MY_ASSIGNED_ACTIVE" : "MY_ASSIGNED_DONE",
    page,
    size: LIST_PAGE_SIZE,
  });
  useClampPage(page, list.isPlaceholderData ? undefined : list.data?.page.totalPages, setPage);
  const rows = list.isError ? [] : (list.data?.content ?? []).map((r) => toMyReviewRow(r, meId));
  return (
    <Panel aria-busy={list.isFetching}>
      <Table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={tableClasses.click} onClick={() => onOpen(row.id)}>
              <td className={tableClasses.id}>{row.id}</td>
              <td className={tableClasses.ttl}>
                {row.title}
                {row.recall ? (
                  <>
                    {" "}
                    <Tag variant="recall">회수 요청됨</Tag>
                  </>
                ) : null}
              </td>
              <td>
                <RequestStatusChip status={row.status} />
              </td>
              <td>{row.role === "주담당" ? <b className={styles.primary}>주담당</b> : "공동 검수"}</td>
              <td>{row.round}</td>
              <td>{row.volume}</td>
              <td>
                {row.due} {row.dueTag ? <Tag variant="hot">{row.dueTag}</Tag> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {list.isPending ? (
        <Empty plain title="검수 요청을 불러오는 중입니다" />
      ) : list.isError ? (
        <Empty
          title="검수 요청을 불러오지 못했습니다"
          description={list.error.message}
          action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
        />
      ) : rows.length === 0 ? (
        <Empty title="해당하는 검수 요청이 없습니다" />
      ) : null}
      {list.data && !list.isError ? (
        <Pager page={page} totalPages={list.data.page.totalPages} onPage={setPage} />
      ) : null}
    </Panel>
  );
}
