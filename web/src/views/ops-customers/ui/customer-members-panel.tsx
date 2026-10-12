"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, formatDate, useClampPage } from "@/shared/lib";
import { Avatar, Button, Empty, Pager, Panel, PanelHeader, Table, Tag } from "@/shared/ui";
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

/** 사용자 of the customer detail page: pending invitations and inactive users included, 20 per page. */
export function CustomerMembersPanel({ customerId, projectName }: CustomerMembersPanelProps) {
  const [page, setPage] = useState(0);
  const members = useOpsCustomerMembers(customerId, page, LIST_PAGE_SIZE);
  const totalPages = members.data?.page.totalPages ?? 0;
  useClampPage(page, members.isPlaceholderData ? undefined : members.data?.page.totalPages, setPage);

  return (
    <Panel className={styles.audit} aria-busy={members.isFetching}>
      <PanelHeader title="사용자" note={members.data ? `${members.data.page.totalElements}명` : undefined} />
      {members.isPending ? (
        <Empty plain title="사용자를 불러오는 중입니다" />
      ) : members.isError ? (
        <Empty
          title="사용자를 불러오지 못했습니다"
          description={members.error.message}
          action={<Button onClick={() => void members.refetch()}>다시 시도</Button>}
        />
      ) : members.data.page.totalElements === 0 ? (
        <Empty title="사용자가 없습니다" description="초기 설정에서 첫 고객사 관리자를 초대하세요." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>사용자</th>
                <th>소속</th>
                <th>관리 권한</th>
                <th>프로젝트 역할</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {members.data.content.map((m) => {
                const roles = roleLines(m, projectName);
                return (
                  <tr key={m.user.id}>
                    <td>
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
                    </td>
                    <td>{m.user.dept ?? <span className={styles.faint}>-</span>}</td>
                    <td>{m.admin ? <Tag variant="fill">고객사 관리자</Tag> : <span className={styles.faint}>-</span>}</td>
                    <td className={styles.detail}>
                      {roles.length ? roles.map((line) => <div key={line}>{line}</div>) : <span className={styles.faint}>-</span>}
                    </td>
                    <td>
                      {m.pending ? (
                        <>
                          <Tag variant="hot">초대 대기</Tag>
                          {m.invitationExpiresAt ? (
                            <div className={styles.smallFaint}>{formatDate(m.invitationExpiresAt)} 만료</div>
                          ) : null}
                        </>
                      ) : m.user.active ? (
                        <Tag>활성</Tag>
                      ) : (
                        <Tag variant="hot">비활성</Tag>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
