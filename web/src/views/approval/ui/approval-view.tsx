"use client";

import { Banner, Button, Empty, ListItem, Page, PageHeader, Panel, PanelHeader, Table, tableClasses } from "@/shared/ui";
import { REQUEST_LIST_PAGE_SIZE, RequestStatusChip, useRequests } from "@/entities/request";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { hasActiveApprover, toApprovalQueueRow } from "../model/approval-rows";
import styles from "./approval.module.css";

const COLUMNS = ["요청 ID", "제목", "차수", "주담당", "콘텐츠", "확정 납기", "처리 가능"];

/** `approval` tab — the project's approval queue (shared by all approvers) and my processed requests. */
export function ApprovalView({ context, openTab }: WorkViewProps) {
  const { projectId, customerId, project } = context;
  const users = useUserDirectory(customerId);
  const scope = { projectId: projectId ?? -1, page: 0, size: REQUEST_LIST_PAGE_SIZE };
  const ready = projectId !== null;
  const queue = useRequests({ ...scope, view: "APPROVAL_QUEUE" }, ready);
  const processed = useRequests({ ...scope, view: "APPROVAL_PROCESSED" }, ready);
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });
  const rows = queue.isError ? [] : (queue.data?.content ?? []).map(toApprovalQueueRow);
  const noApprover =
    !!project && users.ready && !hasActiveApprover(project.members, (id) => users.get(id)?.active ?? false);
  const done = processed.isError ? [] : (processed.data?.content ?? []);

  return (
    <Page wide>
      <PageHeader title="승인" description="프로젝트 승인자 모두가 같은 대기열을 봅니다. 한 명이 처리하면 상태가 바뀝니다." />
      {noApprover ? (
        <Banner tone="danger" title="활성 승인자가 없습니다">
          이 상태에서는 검수 완료 후 승인 대기로 넘길 수 없습니다. 대체 처리와 지연 통지 방식은 협의 중입니다.
        </Banner>
      ) : null}
      <Panel className={styles.queue} aria-busy={queue.isFetching}>
        <PanelHeader title="승인 대기" note={`${queue.data?.page.totalElements ?? rows.length}건`} />
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
              <tr key={row.id} className={tableClasses.click} onClick={() => openRequest(row.id)}>
                <td className={tableClasses.id}>{row.id}</td>
                <td className={tableClasses.ttl}>{row.title}</td>
                <td>{row.round}</td>
                <td>{users.name(row.primaryReviewerId)}</td>
                <td>{row.contents}</td>
                <td>{row.due}</td>
                <td>{row.canProcess ? "가능" : <span className={styles.faint}>본인 관여 요청</span>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {queue.isPending ? (
          <Empty plain title="승인 대기 요청을 불러오는 중입니다" />
        ) : queue.isError ? (
          <Empty
            title="승인 대기 요청을 불러오지 못했습니다"
            description={queue.error.message}
            action={<Button onClick={() => void queue.refetch()}>다시 시도</Button>}
          />
        ) : rows.length === 0 ? (
          <Empty title="승인할 요청이 없습니다" />
        ) : null}
      </Panel>
      <Panel aria-busy={processed.isFetching}>
        <PanelHeader title="내가 처리한 요청" />
        {processed.isPending ? (
          <Empty plain title="처리 이력을 불러오는 중입니다" />
        ) : processed.isError ? (
          <Empty
            title="처리 이력을 불러오지 못했습니다"
            description={processed.error.message}
            action={<Button onClick={() => void processed.refetch()}>다시 시도</Button>}
          />
        ) : done.length === 0 ? (
          <Empty title="처리 이력이 없습니다" />
        ) : (
          done.map((r) => (
            <ListItem
              key={r.id}
              leading={<RequestStatusChip status={r.status} />}
              title={r.title || "제목 없는 요청"}
              meta={r.id}
              onClick={() => openRequest(r.id)}
            />
          ))
        )}
      </Panel>
    </Page>
  );
}
