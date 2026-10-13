"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel, Table, Tag, tableClasses } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { useManagedProjects, type Project } from "@/entities/project";
import { useCustomerUsers, useUserDirectory, type UserDirectory, type UserSummary } from "@/entities/user";
import { ProjectEditDialog } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-projects.module.css";

type Editing = { project: Project | null } | null;

/** `projects` tab — projects of the selected customer (reference `vProjects`). */
export function AdminProjectsView({ context }: WorkViewProps) {
  const { customer, customerId } = context;
  const [page, setPage] = useListPage(String(customerId));
  const projects = useManagedProjects(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, projects.isPlaceholderData ? undefined : projects.data?.page.totalPages, setPage);
  const users = useCustomerUsers(customerId);
  const directory = useUserDirectory(customerId);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <Page>
      <PageHeader
        title="프로젝트 관리"
        description={`${customer?.name ?? ""}의 프로젝트입니다. 이력이 있는 프로젝트는 삭제하지 않고 사용 중지로 보존합니다.`}
        actions={
          <Button variant="pri" onClick={() => setEditing({ project: null })}>
            <Icon name="plus" />
            프로젝트 추가
          </Button>
        }
      />
      <Panel aria-busy={projects.isFetching}>
        {projects.isPending ? (
          <Empty plain title="프로젝트를 불러오는 중입니다" />
        ) : projects.isError ? (
          <Empty
            title="프로젝트를 불러오지 못했습니다"
            description={projects.error.message}
            action={<Button onClick={() => void projects.refetch()}>다시 시도</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>대표 검수자</th>
                <th>승인자</th>
                <th>구성원</th>
                <th>진행 중 요청</th>
                <th>상태</th>
                <th>
                  <span className={styles.sr}>편집</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.data.content.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  approvalEnabled={customer?.approvalEnabled ?? false}
                  users={directory}
                  onEdit={() => setEditing({ project: p })}
                />
              ))}
            </tbody>
          </Table>
        )}
        {projects.isSuccess ? <Pager page={page} totalPages={projects.data.page.totalPages} onPage={setPage} /> : null}
      </Panel>
      {customer && editing ? (
        <ProjectEditor
          customer={customer}
          project={editing.project}
          users={users.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Page>
  );
}

interface ProjectRowProps {
  project: Project;
  approvalEnabled: boolean;
  users: UserDirectory;
  onEdit: () => void;
}

function ProjectEditor({
  customer,
  project,
  users,
  onClose,
}: {
  customer: NonNullable<WorkViewProps["context"]["customer"]>;
  project: Project | null;
  users: UserSummary[];
  onClose: () => void;
}) {
  return (
    <ProjectEditDialog
      open
      onClose={onClose}
      customer={customer}
      project={project}
      users={users}
      inProgress={project?.activeRequestCount ?? 0}
    />
  );
}

function ProjectRow({ project: p, approvalEnabled, users, onEdit }: ProjectRowProps) {
  const approvers = p.members.filter((m) => m.roles.includes("APPROVER")).map((m) => users.name(m.userId));
  return (
    <tr>
      <td className={tableClasses.ttl}>{p.name}</td>
      <td>{users.name(p.leadUserId)}</td>
      <td>{approvalEnabled ? approvers.join(", ") || "-" : <span className={styles.faint}>승인 단계 미사용</span>}</td>
      <td>{p.members.length}명</td>
      {/* 진행 중 요청 = submitted and not final, counted by the server for the customer admin (§14.6) */}
      <td>{p.activeRequestCount ?? "-"}</td>
      <td>{p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>}</td>
      <td>
        <Button size="sm" onClick={onEdit}>
          편집
        </Button>
      </td>
    </tr>
  );
}
