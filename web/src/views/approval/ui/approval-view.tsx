"use client";

import { LIST_PAGE_SIZE, formatDate, useClampPage, useListPage } from "@/shared/lib";
import { Banner, Empty, Page, PageHeader, Panel, PanelHeader } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import { RequestStatusChip, useRequests, type RequestSummary } from "@/entities/request";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { hasActiveApprover, toApprovalQueueRow, type ApprovalQueueRow } from "../model/approval-rows";
import styles from "./approval.module.css";

/**
 * `approval` tab — the project's approval queue (shared by all approvers) and my processed requests,
 * each paged on its own (20 per page). A row click (or the title, by keyboard) opens the request.
 */
export function ApprovalView({ context, openTab }: WorkViewProps) {
  const { projectId, customerId, project } = context;
  const users = useUserDirectory(customerId);
  const scope = { projectId: projectId ?? -1, size: LIST_PAGE_SIZE };
  const ready = projectId !== null;
  const [queuePage, setQueuePage] = useListPage(String(projectId));
  const [processedPage, setProcessedPage] = useListPage(String(projectId));
  const queue = useRequests({ ...scope, view: "APPROVAL_QUEUE", page: queuePage }, ready);
  const processed = useRequests({ ...scope, view: "APPROVAL_PROCESSED", page: processedPage }, ready);
  useClampPage(queuePage, queue.isPlaceholderData ? undefined : queue.data?.page.totalPages, setQueuePage);
  useClampPage(
    processedPage,
    processed.isPlaceholderData ? undefined : processed.data?.page.totalPages,
    setProcessedPage,
  );
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });
  const rows = (queue.data?.content ?? []).map(toApprovalQueueRow);
  const noApprover =
    !!project && users.ready && !hasActiveApprover(project.members, (id) => users.get(id)?.active ?? false);
  const done = processed.data?.content ?? [];

  const queueColumns: DataTableColumn<ApprovalQueueRow>[] = [
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="whitespace-nowrap text-sub">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: (r) => (
        <RowLink onClick={() => openRequest(r.id)} label={`${r.id} ${r.title} 열기`}>
          {r.title}
        </RowLink>
      ),
    },
    { id: "round", name: "차수", width: "64px", cell: (r) => r.round },
    { id: "primary", name: "주담당", width: "112px", cell: (r) => users.name(r.primaryReviewerId) },
    { id: "contents", name: "콘텐츠", width: "140px", cell: (r) => r.contents },
    { id: "due", name: "확정 납기", width: "104px", cell: (r) => r.due },
    {
      id: "can",
      name: "처리 가능",
      width: "128px",
      cell: (r) => (r.canProcess ? "가능" : <span className={styles.faint}>본인 관여 요청</span>),
    },
  ];
  const doneColumns: DataTableColumn<RequestSummary>[] = [
    { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className="whitespace-nowrap text-sub">{r.id}</span> },
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: (r) => (
        <RowLink onClick={() => openRequest(r.id)} label={`${r.id} ${r.title || "제목 없는 요청"} 열기`}>
          {r.title || "제목 없는 요청"}
        </RowLink>
      ),
    },
    { id: "status", name: "상태", width: "104px", cell: (r) => <RequestStatusChip status={r.status} /> },
    { id: "round", name: "차수", width: "64px", cell: (r) => `${r.round}차` },
    { id: "due", name: "확정 납기", width: "104px", cell: (r) => formatDate(r.dueDate) },
  ];

  return (
    <Page>
      <PageHeader title="승인" description="프로젝트 승인자 모두가 같은 대기열을 봅니다. 한 명이 처리하면 상태가 바뀝니다." />
      {noApprover ? (
        <Banner tone="danger" title="활성 승인자가 없습니다">
          이 상태에서는 검수 완료 후 승인 대기로 넘길 수 없습니다. 대체 처리와 지연 통지 방식은 협의 중입니다.
        </Banner>
      ) : null}
      <Panel className={styles.queue} aria-busy={queue.isFetching}>
        <PanelHeader title="승인 대기" note={`${queue.data?.page.totalElements ?? 0}건`} />
        {queue.isError ? (
          <Empty
            title="승인 대기 요청을 불러오지 못했습니다"
            description={queue.error.message}
            action={<Button onClick={() => void queue.refetch()}>다시 시도</Button>}
          />
        ) : (
          <DataTable
            label="승인 대기"
            columns={queueColumns}
            data={rows}
            onRowClick={(r) => openRequest(r.id)}
            loading={queue.isPending}
            page={
              queue.data
                ? { number: queuePage, size: queue.data.page.size, totalElements: queue.data.page.totalElements }
                : undefined
            }
            onPage={setQueuePage}
            empty={<Empty title="승인할 요청이 없습니다" description="검수가 끝나 승인 대기로 넘어온 요청이 여기에 표시됩니다." />}
          />
        )}
      </Panel>
      <Panel aria-busy={processed.isFetching}>
        <PanelHeader title="내가 처리한 요청" />
        {processed.isError ? (
          <Empty
            title="처리 이력을 불러오지 못했습니다"
            description={processed.error.message}
            action={<Button onClick={() => void processed.refetch()}>다시 시도</Button>}
          />
        ) : (
          <DataTable
            label="내가 처리한 요청"
            columns={doneColumns}
            data={done}
            onRowClick={(r) => openRequest(r.id)}
            loading={processed.isPending}
            page={
              processed.data
                ? { number: processedPage, size: processed.data.page.size, totalElements: processed.data.page.totalElements }
                : undefined
            }
            onPage={setProcessedPage}
            empty={<Empty title="처리 이력이 없습니다" description="승인하거나 수정 요청한 요청이 여기에 쌓입니다." />}
          />
        )}
      </Panel>
    </Page>
  );
}
