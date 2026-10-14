"use client";

import { Empty, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { Button } from "@/shared/common";
import { useWorkload } from "@/entities/dashboard";
import type { UserDirectory } from "@/entities/user";
import { WorkloadTable } from "@/widgets/workload-table";
import { AssignQueue } from "./assign-queue";

export interface AssignManagementProps {
  projectId: number;
  users: UserDirectory;
  onOpen: (id: string) => void;
  /** Opens the request tab with the assignment modal. */
  onAssign: (id: string) => void;
}

/** 배정 관리 (lead): 배정 대기 / 지연 / 납기 임박 queues and the reviewer workload table. */
export function AssignManagement({ projectId, users, onOpen, onAssign }: AssignManagementProps) {
  const queue = { projectId, users, onOpen };
  return (
    <>
      <AssignQueue
        {...queue}
        title="배정 대기"
        view="WAITING_ASSIGNMENT"
        onAssign={onAssign}
        emptyText="배정을 기다리는 요청이 없습니다."
      />
      <AssignQueue {...queue} title="지연" view="OVERDUE" emptyText="납기가 지난 요청이 없습니다." />
      <AssignQueue {...queue} title="납기 임박" view="DUE_SOON" emptyText="납기가 임박한 요청이 없습니다." />
      <Panel>
        <PanelHeader title="검수자별 활성 요청과 업무량" />
        <PanelBody>
          <ProjectWorkload projectId={projectId} users={users} />
        </PanelBody>
      </Panel>
    </>
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
