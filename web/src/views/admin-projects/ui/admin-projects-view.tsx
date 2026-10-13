"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel, Table, Tag, tableClasses } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { useManagedProjects, type Project } from "@/entities/project";
import { useCustomerUsers, useUserDirectory, type UserDirectory } from "@/entities/user";
import {
  ProjectConfirmDialog,
  ProjectEditDialog,
  ProjectInfoDialog,
  ProjectMembersDialog,
  useProjectResume,
  type ProjectConfirm,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-projects.module.css";

/** Which modal is open: 정보 / 추가·수정 / 구성원 / 사용 중지·삭제 확인. */
type Dialog =
  | { kind: "info"; project: Project }
  | { kind: "edit"; project: Project | null }
  | { kind: "members"; project: Project }
  | ({ kind: "confirm" } & ProjectConfirm)
  | null;

/**
 * `projects` tab — 프로젝트 관리 of the selected customer (reference `vProjects`, 기획서 11.1·11.2, contract §24):
 * 추가 · 정보 · 수정 · 구성원(참여 범위) · 사용 중지/사용 · 삭제(이력 없는 프로젝트만), all in modals.
 */
export function AdminProjectsView({ context }: WorkViewProps) {
  const { customer, customerId } = context;
  const [page, setPage] = useListPage(String(customerId));
  const projects = useManagedProjects(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, projects.isPlaceholderData ? undefined : projects.data?.page.totalPages, setPage);
  const users = useCustomerUsers(customerId);
  const directory = useUserDirectory(customerId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const resume = useProjectResume();
  const approvalEnabled = customer?.approvalEnabled ?? false;
  // the open modal follows the refreshed list (after a save elsewhere in the same modal flow)
  const current = (p: Project) => projects.data?.content.find((x) => x.id === p.id) ?? p;

  return (
    <Page>
      <PageHeader
        title="프로젝트 관리"
        description={`${customer?.name ?? ""}의 프로젝트입니다. 이력이 있는 프로젝트는 삭제하지 않고 사용 중지로 보존합니다.`}
        actions={
          <Button variant="pri" onClick={() => setDialog({ kind: "edit", project: null })}>
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
                  <span className={styles.sr}>관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.data.content.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  approvalEnabled={approvalEnabled}
                  users={directory}
                  onOpen={(kind) =>
                    kind === "stop" || kind === "delete"
                      ? setDialog({ kind: "confirm", project: p, action: kind })
                      : setDialog({ kind, project: p })
                  }
                  onResume={() => void resume(p)}
                />
              ))}
            </tbody>
          </Table>
        )}
        {projects.isSuccess && projects.data.content.length === 0 ? <Empty title="프로젝트가 없습니다" /> : null}
        {projects.isSuccess ? <Pager page={page} totalPages={projects.data.page.totalPages} onPage={setPage} /> : null}
      </Panel>
      {customer ? (
        <>
          <ProjectInfoDialog
            project={dialog?.kind === "info" ? current(dialog.project) : null}
            onClose={() => setDialog(null)}
            customer={customer}
            users={directory}
            onEdit={(p) => setDialog({ kind: "edit", project: p })}
            onMembers={(p) => setDialog({ kind: "members", project: p })}
          />
          <ProjectEditDialog
            open={dialog?.kind === "edit"}
            onClose={() => setDialog(null)}
            customer={customer}
            project={dialog?.kind === "edit" ? dialog.project : null}
            users={users.data ?? []}
            inProgress={dialog?.kind === "edit" ? (dialog.project?.activeRequestCount ?? 0) : 0}
          />
          <ProjectMembersDialog
            open={dialog?.kind === "members"}
            onClose={() => setDialog(null)}
            customer={customer}
            project={dialog?.kind === "members" ? current(dialog.project) : null}
            users={users.data ?? []}
          />
        </>
      ) : null}
      <ProjectConfirmDialog
        confirm={dialog?.kind === "confirm" ? { project: dialog.project, action: dialog.action } : null}
        onClose={() => setDialog(null)}
      />
    </Page>
  );
}

interface ProjectRowProps {
  project: Project;
  approvalEnabled: boolean;
  users: UserDirectory;
  onOpen: (kind: "info" | "edit" | "members" | "stop" | "delete") => void;
  onResume: () => void;
}

function ProjectRow({ project: p, approvalEnabled, users, onOpen, onResume }: ProjectRowProps) {
  const approvers = p.members.filter((m) => m.roles.includes("APPROVER")).map((m) => users.name(m.userId));
  return (
    <tr>
      <td className={tableClasses.ttl}>
        <button
          type="button"
          className={styles.titleBtn}
          aria-label={`${p.name} 정보`}
          onClick={() => onOpen("info")}
        >
          {p.name}
        </button>
      </td>
      <td>{users.name(p.leadUserId)}</td>
      <td>{approvalEnabled ? approvers.join(", ") || "-" : <span className={styles.faint}>승인 단계 미사용</span>}</td>
      <td>{p.members.length}명</td>
      {/* 진행 중 요청 = submitted and not final, counted by the server for the customer admin (§14.6) */}
      <td>{p.activeRequestCount ?? "-"}</td>
      <td>{p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>}</td>
      <td>
        <div className={styles.actions}>
          <Button size="sm" onClick={() => onOpen("edit")}>
            수정
          </Button>
          <Button size="sm" onClick={() => onOpen("members")}>
            구성원
          </Button>
          {p.active ? (
            <Button size="sm" variant="ghost" onClick={() => onOpen("stop")}>
              사용 중지
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onResume}>
              사용
            </Button>
          )}
          {p.deletable ? (
            <Button size="sm" variant="ghost" onClick={() => onOpen("delete")}>
              삭제
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
