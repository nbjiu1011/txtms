"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage, useViewIntent } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, Pager, SubTabs } from "@/shared/common";
import { useCustomerMembers, type DeactivationImpact, type Member } from "@/entities/user";
import {
  ChangeEmailDialog,
  DeactivateUserDialog,
  InviteUserDialog,
  RoleEditDialog,
  useMemberActions,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AuditPanel } from "./audit-panel";
import { OutboxPanel } from "./outbox-panel";
import { UsersTable } from "./users-table";

type Sub = "users" | "audit";
/** View-intent key (= route key): the dashboard admin banner opens the audit sub tab. */
const USERS_INTENT = "adminUsers";

type Dialog =
  | { kind: "invite" }
  | { kind: "roles"; member: Member }
  | { kind: "email"; member: Member }
  | { kind: "deactivate"; member: Member; impact: DeactivationImpact }
  | null;

/** `users` tab — 사용자·권한 관리 (reference `vUsers` + J; 운영 지원 접근 is Phase 2, 접근·변경 기록 instead). */
export function AdminUsersView({ context, openTab }: WorkViewProps) {
  const { customer, customerId, projects, projectId } = context;
  const [page, setPage] = useListPage(String(customerId));
  const members = useCustomerMembers(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, members.isPlaceholderData ? undefined : members.data?.page.totalPages, setPage);
  const actions = useMemberActions(customerId ?? -1);
  const [sub, setSub] = useState<Sub>("users");
  const [dialog, setDialog] = useState<Dialog>(null);
  // The dashboard admin banner (접근 기록 보기) asks for the audit sub tab until the user picks one.
  const intent = useViewIntent((s) => s.intents[USERS_INTENT]);
  const current: Sub = intent === "audit" ? "audit" : sub;
  const pickSub = (next: Sub) => {
    useViewIntent.getState().consume(USERS_INTENT);
    setSub(next);
  };
  const close = () => setDialog(null);

  if (!customer || customerId === null) return null;
  const list = members.data?.content ?? [];

  return (
    <>
      <Page>
        <PageHeader
          title="사용자·권한 관리"
          description="한 사용자가 여러 역할을 가질 수 있지만 요청자와 검수자는 함께 가질 수 없습니다. 역할이 바뀌어도 접근 범위는 자동으로 넓어지지 않습니다."
          actions={
            <Button variant="pri" onClick={() => setDialog({ kind: "invite" })}>
              <Icon name="plus" />
              사용자 초대
            </Button>
          }
        />
        <SubTabs
          label="사용자·권한 관리"
          items={[
            { key: "users", label: "사용자와 역할" },
            { key: "audit", label: "접근·변경 기록" },
          ]}
          value={current}
          onChange={pickSub}
        />
        {current === "audit" ? (
          <AuditPanel customerId={customerId} />
        ) : (
          <Panel aria-busy={members.isFetching}>
            {members.isPending ? (
              <Empty plain title="사용자를 불러오는 중입니다" />
            ) : members.isError ? (
              <Empty
                title="사용자를 불러오지 못했습니다"
                description={members.error.message}
                action={<Button onClick={() => void members.refetch()}>다시 시도</Button>}
              />
            ) : (
              <>
              <UsersTable
                members={list}
                projects={projects}
                busyId={actions.busyId}
                onOpen={(member) => openTab({ route: "adminUser", params: { id: String(member.user.id) } })}
                onRoles={(member) => setDialog({ kind: "roles", member })}
                onEmail={(member) => setDialog({ kind: "email", member })}
                onReissue={(member) => void actions.reissue(member)}
                onReactivate={(member) => void actions.reactivate(member)}
                onDeactivate={async (member) => {
                  const impact = await actions.loadImpact(member);
                  if (impact) setDialog({ kind: "deactivate", member, impact });
                }}
              />
              <Pager page={page} totalPages={members.data.page.totalPages} onPage={setPage} />
              </>
            )}
          </Panel>
        )}
      </Page>
      {/* reference: the outbox is a second `.page` block after the users page */}
      <Page>
        <OutboxPanel customerId={customerId} />
      </Page>
      <InviteUserDialog
        open={dialog?.kind === "invite"}
        onClose={close}
        customer={customer}
        projects={projects}
        projectId={projectId}
      />
      <RoleEditDialog
        open={dialog?.kind === "roles"}
        onClose={close}
        customer={customer}
        projects={projects}
        member={dialog?.kind === "roles" ? dialog.member : null}
      />
      <ChangeEmailDialog
        open={dialog?.kind === "email"}
        onClose={close}
        customer={customer}
        member={dialog?.kind === "email" ? dialog.member : null}
      />
      <DeactivateUserDialog
        open={dialog?.kind === "deactivate"}
        onClose={close}
        customerId={customerId}
        member={dialog?.kind === "deactivate" ? dialog.member : null}
        impact={dialog?.kind === "deactivate" ? dialog.impact : null}
      />
    </>
  );
}
