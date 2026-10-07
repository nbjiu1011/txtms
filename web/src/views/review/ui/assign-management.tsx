"use client";

import { Button, Empty, ListItem, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { useWorkload } from "@/entities/dashboard";
import {
  REQUEST_LIST_PAGE_SIZE,
  RequestStatusChip,
  useRequests,
  type RequestListView,
  type RequestSummary,
} from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import { WorkloadTable } from "@/widgets/workload-table";
import { assignQueueMeta } from "../model/review-rows";
import styles from "./review.module.css";

export interface AssignManagementProps {
  projectId: number;
  users: UserDirectory;
  onOpen: (id: string) => void;
  /** Opens the request tab with the assignment modal. */
  onAssign: (id: string) => void;
}

/** 배정 관리 (lead): 배정 대기 / 지연 / 납기 임박 queues and the reviewer workload table. */
export function AssignManagement({ projectId, users, onOpen, onAssign }: AssignManagementProps) {
  return (
    <>
      <div className={styles.grid3}>
        <QueuePanel title="배정 대기" view="WAITING_ASSIGNMENT" projectId={projectId} users={users} onOpen={onOpen} onAssign={onAssign} />
        <QueuePanel title="지연" view="OVERDUE" projectId={projectId} users={users} onOpen={onOpen} />
        <QueuePanel title="납기 임박" view="DUE_SOON" projectId={projectId} users={users} onOpen={onOpen} />
      </div>
      <Panel>
        <PanelHeader title="검수자별 활성 요청과 업무량" />
        <PanelBody>
          <ProjectWorkload projectId={projectId} users={users} />
        </PanelBody>
      </Panel>
    </>
  );
}

interface QueuePanelProps {
  title: string;
  view: RequestListView;
  projectId: number;
  users: UserDirectory;
  onOpen: (id: string) => void;
  onAssign?: (id: string) => void;
}

function QueuePanel({ title, view, projectId, users, onOpen, onAssign }: QueuePanelProps) {
  const list = useRequests({ projectId, view, page: 0, size: REQUEST_LIST_PAGE_SIZE });
  const rows: RequestSummary[] = list.isError ? [] : (list.data?.content ?? []);
  const total = list.data?.page.totalElements ?? rows.length;
  return (
    <Panel aria-label={title} aria-busy={list.isFetching}>
      <PanelHeader title={title} note={`${total}건`} />
      {list.isPending ? (
        <div className={styles.none}>불러오는 중</div>
      ) : list.isError ? (
        <div className={styles.none}>
          불러오지 못했습니다{" "}
          <Button size="sm" onClick={() => void list.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.none}>없음</div>
      ) : (
        rows.map((r) => (
          <ListItem
            key={r.id}
            nestedActions={!!onAssign}
            leading={<RequestStatusChip status={r.status} />}
            title={r.title || "제목 없는 요청"}
            meta={assignQueueMeta(r, users.name(r.requesterId))}
            trailing={
              onAssign ? (
                <Button
                  size="sm"
                  variant="pri"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(r.id);
                  }}
                >
                  배정
                </Button>
              ) : (
                <span className={styles.faintSmall}>{r.reviewerIds.map((id) => users.name(id)).join(", ")}</span>
              )
            }
            onClick={() => onOpen(r.id)}
          />
        ))
      )}
    </Panel>
  );
}

/** Reviewer workload (`GET /api/projects/{id}/workload`, reference `workloadRows`). */
export function ProjectWorkload({ projectId, users }: { projectId: number; users: UserDirectory }) {
  const workload = useWorkload(projectId);
  if (workload.isPending) return <Empty plain title="업무량을 불러오는 중입니다" />;
  if (workload.isError) {
    return (
      <Empty
        plain
        title="업무량을 불러오지 못했습니다"
        description={workload.error.message}
        action={<Button onClick={() => void workload.refetch()}>다시 시도</Button>}
      />
    );
  }
  return <WorkloadTable rows={workload.data} users={users} />;
}
