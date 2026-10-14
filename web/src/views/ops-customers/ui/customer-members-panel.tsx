"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, formatDate, useClampPage } from "@/shared/lib";
import { Avatar, Empty, Panel, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import { useOpsCustomerMembers } from "@/entities/ops";
import { LEAD_ROLE_LABEL, PROJECT_ROLE_LABEL } from "@/entities/project";
import type { Member } from "@/entities/user";
import styles from "./ops-customers.module.css";

export interface CustomerMembersPanelProps {
  customerId: number;
  /** Project id → name of the customer (reference data); null while loading. */
  projectName: (id: number) => string | null;
}

/** `{프로젝트}: 역할, 대표 검수자` per project of a member. */
function roleLines(member: Member, projectName: (id: number) => string | null): string[] {
  return member.projects.map((p) => {
    const labels = p.roles.map((r) => PROJECT_ROLE_LABEL[r]);
    if (p.lead) labels.push(LEAD_ROLE_LABEL);
    return `${projectName(p.projectId) ?? `프로젝트 ${p.projectId}`}: ${labels.join(", ")}`;
  });
}

function MemberCell({ m }: { m: Member }) {
  return (
    <span className={styles.user}>
      <Avatar name={m.user.name} color={m.user.avatarColor} size={24} />
      <span>
        <b>{m.user.name}</b>
        <br />
        <span className={styles.smallFaint}>{m.user.email}</span>
        {m.pendingEmail ? (
          <span className={styles.smallFaint}>
            <br />
            변경 확인 대기: {m.pendingEmail}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function StatusCell({ m }: { m: Member }) {
  if (m.pending) {
    return (
      <span>
        <Tag variant="hot">초대 대기</Tag>
        {m.invitationExpiresAt ? <span className={styles.smallBlock}>{formatDate(m.invitationExpiresAt)} 만료</span> : null}
      </span>
    );
  }
  return m.user.active ? <Tag>활성</Tag> : <Tag variant="hot">비활성</Tag>;
}

/** 사용자 of the customer detail page: pending invitations and inactive users included, 20 per page (no row click). */
export function CustomerMembersPanel({ customerId, projectName }: CustomerMembersPanelProps) {
  const [page, setPage] = useState(0);
  const members = useOpsCustomerMembers(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, members.isPlaceholderData ? undefined : members.data?.page.totalPages, setPage);

  const columns: DataTableColumn<Member>[] = [
    { id: "user", name: "사용자", grow: 1, minWidth: "220px", cell: (m) => <MemberCell m={m} /> },
    { id: "dept", name: "소속", width: "120px", cell: (m) => m.user.dept ?? <span className={styles.faint}>-</span> },
    {
      id: "admin",
      name: "관리 권한",
      width: "120px",
      cell: (m) => (m.admin ? <Tag variant="fill">고객사 관리자</Tag> : <span className={styles.faint}>-</span>),
    },
    {
      id: "roles",
      name: "프로젝트 역할",
      width: "260px",
      wrap: true,
      cell: (m) => {
        const roles = roleLines(m, projectName);
        return roles.length ? (
          <span className={styles.detail}>
            {roles.map((line) => (
              <span key={line} className={styles.line}>
                {line}
              </span>
            ))}
          </span>
        ) : (
          <span className={styles.faint}>-</span>
        );
      },
    },
    { id: "status", name: "상태", width: "110px", cell: (m) => <StatusCell m={m} /> },
  ];

  return (
    <Panel className={styles.audit} aria-busy={members.isFetching}>
      <PanelHeader title="사용자" note={members.data ? `${members.data.page.totalElements}명` : undefined} />
      {members.isError ? (
        <Empty
          title="사용자를 불러오지 못했습니다"
          description={members.error.message}
          action={<Button onClick={() => void members.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="고객사 사용자"
          columns={columns}
          // members have no top-level id: key the rows by the user
          data={(members.data?.content ?? []).map((m) => ({ ...m, rowKey: m.user.id }))}
          keyField="rowKey"
          loading={members.isPending}
          page={
            members.data ? { number: page, size: members.data.page.size, totalElements: members.data.page.totalElements } : undefined
          }
          onPage={setPage}
          empty={<Empty title="사용자가 없습니다" description="초기 설정에서 첫 고객사 관리자를 초대하세요." />}
        />
      )}
    </Panel>
  );
}
