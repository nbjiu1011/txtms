"use client";

import { Fragment } from "react";
import { Avatar, Bar, Button, Empty, ListItem, Panel, PanelBody, PanelHeader, Table, Tag } from "@/shared/ui";
import { useWorkload, type WorkloadRow } from "@/entities/dashboard";
import {
  FILE_UNIT_LABEL,
  REQUEST_LIST_PAGE_SIZE,
  RequestStatusChip,
  useRequests,
  type RequestListView,
  type RequestSummary,
} from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
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
          <WorkloadTable projectId={projectId} users={users} />
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

const WORKLOAD_COLUMNS = ["검수자", "활성 요청", "주담당", "납기 임박·지연", "문안 글자 수", "파일 실제 검수 범위"];

/** Reviewer workload (`GET /api/projects/{id}/workload`, reference `workloadRows`). */
export function WorkloadTable({ projectId, users }: { projectId: number; users: UserDirectory }) {
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
  const rows: WorkloadRow[] = workload.data;
  const max = Math.max(1, ...rows.map((r) => r.active));
  return (
    <>
      <Table>
        <thead>
          <tr>
            {WORKLOAD_COLUMNS.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th className={styles.loadCol}>부하</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const user = users.get(row.userId);
            const name = user?.name ?? "-";
            return (
              <tr key={row.userId}>
                <td>
                  <span className={styles.person}>
                    <Avatar name={name} color={user?.avatarColor} size={22} />
                    {name}
                  </span>
                </td>
                <td>{row.active}</td>
                <td>{row.primary}</td>
                <td>{row.dueSoonOrOverdue}</td>
                <td>{row.chars.toLocaleString("ko-KR")}자</td>
                <td>
                  {row.files.length ? (
                    row.files.map((f, i) => (
                      <Fragment key={f.unit}>
                        {i > 0 ? " " : null}
                        <Tag>
                          {FILE_UNIT_LABEL[f.unit]} {f.amount}
                        </Tag>
                      </Fragment>
                    ))
                  ) : (
                    <span className={styles.faint}>-</span>
                  )}
                </td>
                <td>
                  <Bar percent={(row.active / max) * 100} label={`${name} 부하`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {rows.length === 0 ? <Empty plain title="검수자가 없습니다" /> : null}
      <p className={styles.wlNote}>
        파일 검수량은 파일 건수가 아니라 실제 검수 범위로 표시하며, 단위가 다르면 합산하지 않습니다.
      </p>
    </>
  );
}
