"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel } from "@/shared/ui";
import { Button } from "@/shared/common";
import { useManagedProjects, type Project } from "@/entities/project";
import { useCustomerUsers, useUserDirectory } from "@/entities/user";
import {
  ProjectConfirmDialog,
  ProjectEditDialog,
  ProjectInfoDialog,
  ProjectMembersDialog,
  useProjectResume,
  type ProjectConfirm,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { ProjectTable } from "./project-table";

/** Which modal is open: 정보 / 추가·수정 / 구성원 / 사용 중지·삭제 확인. */
type Dialog =
  | { kind: "info"; project: Project }
  | { kind: "edit"; project: Project | null }
  | { kind: "members"; project: Project }
  | ({ kind: "confirm" } & ProjectConfirm)
  | null;

/**
 * `projects` tab — 프로젝트 관리 of the selected customer (reference `vProjects`, 기획서 11.1·11.2, contract §24).
 * A row opens 프로젝트 정보, which holds 수정 · 구성원 · 사용 중지/사용 · 삭제(이력 없는 프로젝트만); the row itself
 * keeps only 구성원, the most frequent task.
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
        description={`${customer?.name ?? ""}의 프로젝트입니다. 프로젝트를 누르면 정보와 관리 메뉴가 열립니다. 이력이 있는 프로젝트는 삭제하지 않고 사용 중지로 보존합니다.`}
        actions={
          <Button variant="pri" onClick={() => setDialog({ kind: "edit", project: null })}>
            <Icon name="plus" />
            프로젝트 추가
          </Button>
        }
      />
      <Panel aria-busy={projects.isFetching}>
        {projects.isError ? (
          <Empty
            title="프로젝트를 불러오지 못했습니다"
            description={projects.error.message}
            action={<Button onClick={() => void projects.refetch()}>다시 시도</Button>}
          />
        ) : (
          <ProjectTable
            rows={projects.data?.content ?? []}
            users={directory}
            approvalEnabled={approvalEnabled}
            loading={projects.isPending}
            page={
              projects.data
                ? { number: page, size: projects.data.page.size, totalElements: projects.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            onOpen={(project) => setDialog({ kind: "info", project })}
            onMembers={(project) => setDialog({ kind: "members", project })}
            empty={<Empty title="프로젝트가 없습니다" description="프로젝트 추가로 첫 프로젝트를 만드세요." />}
          />
        )}
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
            onConfirm={(p, action) => setDialog({ kind: "confirm", project: p, action })}
            onResume={(p) => void resume(p)}
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
