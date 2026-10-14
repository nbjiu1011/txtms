"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Avatar, Banner, Empty, KeyValueList, Page, PageHeader, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Button } from "@/shared/common";
import type { DeactivationImpact, Member } from "@/entities/user";
import {
  AdminRightDialog,
  ChangeEmailDialog,
  DeactivateUserDialog,
  RoleEditDialog,
  UserProfileDialog,
  useMemberActions,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useUserTab } from "../model/use-user-tab";
import { UserRoles } from "./user-roles";
import { UserWork } from "./user-work";
import styles from "./user-detail.module.css";

type Dialog =
  | { kind: "profile" | "email" | "roles" | "admin" }
  | { kind: "deactivate"; impact: DeactivationImpact }
  | null;

function statusTag(m: Member) {
  if (m.pending) return <Tag variant="fill">초대 대기</Tag>;
  return m.user.active ? <Tag>활성</Tag> : <Tag variant="hot">비활성</Tag>;
}

/**
 * `adminUser` tab — 사용자 상세 of the customer admin (contract §25): state, basic information, roles per project, work
 * in progress, and every user action of 사용자·권한 관리 in modals.
 */
export function AdminUserDetailView({ tab, context, openTab, setTitle }: WorkViewProps) {
  const { customer, customerId, projects } = context;
  const { member, missing } = useUserTab({ tab, setTitle, customerId });
  const actions = useMemberActions(customerId ?? -1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const back = <Button onClick={() => openTab({ route: "adminUsers", params: {} })}>목록</Button>;

  if (!customer || customerId === null || !member.data) {
    return (
      <Page>
        <PageHeader title="사용자·권한 관리" actions={back} />
        <Panel>
          {missing ? (
            <Empty title="사용자를 찾을 수 없습니다" description="선택한 고객사의 사용자가 아닙니다." action={back} />
          ) : member.isError ? (
            <Empty
              title="사용자를 불러오지 못했습니다"
              description={member.error.message}
              action={<Button onClick={() => void member.refetch()}>다시 시도</Button>}
            />
          ) : (
            <Empty plain title="사용자를 불러오는 중입니다" />
          )}
        </Panel>
      </Page>
    );
  }

  const m = member.data;
  const accepted = !m.pending;
  const busy = actions.busyId === m.user.id;

  return (
    <Page aria-busy={member.isFetching}>
      <PageHeader
        title={m.user.name}
        description={m.user.email}
        actions={<div className={styles.actions}>{back}</div>}
      />
      {m.pending ? (
        <Banner tone="wait" className={styles.block} title="초대를 수락하지 않은 사용자입니다">
          {m.invitationExpiresAt
            ? `초대 링크는 ${formatDateTime(m.invitationExpiresAt)}까지 쓸 수 있습니다.`
            : "사용할 수 있는 초대 링크가 없습니다. 초대를 다시 보내세요."}
        </Banner>
      ) : !m.user.active ? (
        <Banner tone="info" className={styles.block} title="비활성화된 사용자입니다">
          로그인할 수 없습니다. 기록과 역할은 보존되며 재활성화할 수 있습니다.
        </Banner>
      ) : null}

      <Panel className={styles.block}>
        <PanelHeader title="기본 정보">
          <div className={styles.headActions}>
            <Button size="sm" onClick={() => setDialog({ kind: "profile" })}>
              정보 수정
            </Button>
            <Button size="sm" onClick={() => setDialog({ kind: "email" })}>
              이메일 변경
            </Button>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className={styles.identity}>
            <Avatar name={m.user.name} color={m.user.avatarColor} size={40} />
            <KeyValueList
              items={[
                { label: "이름", value: m.user.name },
                { label: "소속", value: m.user.dept ?? "-" },
                { label: "이메일", value: m.user.email },
                ...(m.pendingEmail ? [{ label: "변경 확인 대기", value: m.pendingEmail }] : []),
                { label: "상태", value: statusTag(m) },
              ]}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel className={styles.block}>
        <PanelHeader title="권한과 역할">
          <div className={styles.headActions}>
            <Button size="sm" onClick={() => setDialog({ kind: "roles" })}>
              역할 관리
            </Button>
            {m.admin || (accepted && m.user.active) ? (
              <Button size="sm" variant={m.admin ? "warn" : "default"} onClick={() => setDialog({ kind: "admin" })}>
                {m.admin ? "관리자 해제" : "관리자 지정"}
              </Button>
            ) : null}
          </div>
        </PanelHeader>
        <PanelBody>
          <KeyValueList
            items={[
              {
                label: "관리 권한",
                value: m.admin ? <Tag variant="fill">고객사 관리자</Tag> : <span className={styles.faint}>없음</span>,
              },
            ]}
          />
        </PanelBody>
        <UserRoles member={m} projects={projects} />
      </Panel>

      {accepted && m.user.active ? <UserWork customerId={customerId} userId={m.user.id} openTab={openTab} /> : null}

      <Panel className={styles.block}>
        <PanelHeader title="계정 상태" />
        <PanelBody>
          <div className={styles.actions}>
            {m.pending ? (
              <Button size="sm" disabled={busy} onClick={() => void actions.reissue(m)}>
                초대 재발급
              </Button>
            ) : m.user.active ? (
              <Button
                size="sm"
                variant="warn"
                disabled={busy}
                onClick={async () => {
                  const impact = await actions.loadImpact(m);
                  if (impact) setDialog({ kind: "deactivate", impact });
                }}
              >
                비활성화
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void actions.reactivate(m)}>
                재활성화
              </Button>
            )}
            <span className={styles.faint}>
              {m.pending
                ? "새 링크를 보내면 이전 링크는 쓸 수 없습니다."
                : m.user.active
                  ? "비활성화하면 진행 업무를 대체자에게 인수인계합니다."
                  : "재활성화하면 비활성화 전 역할로 돌아옵니다."}
            </span>
          </div>
        </PanelBody>
      </Panel>

      <UserProfileDialog open={dialog?.kind === "profile"} onClose={close} customerId={customerId} member={m} />
      <ChangeEmailDialog open={dialog?.kind === "email"} onClose={close} customer={customer} member={m} />
      <RoleEditDialog open={dialog?.kind === "roles"} onClose={close} customer={customer} projects={projects} member={m} />
      <AdminRightDialog open={dialog?.kind === "admin"} onClose={close} customerId={customerId} member={m} />
      <DeactivateUserDialog
        open={dialog?.kind === "deactivate"}
        onClose={close}
        customerId={customerId}
        member={m}
        impact={dialog?.kind === "deactivate" ? dialog.impact : null}
      />
    </Page>
  );
}
