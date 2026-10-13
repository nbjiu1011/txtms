"use client";

import { KeyValueList, Table, Tag, tableClasses } from "@/shared/ui";
import { Button, Modal } from "@/shared/common";
import type { Customer } from "@/entities/customer";
import { LEAD_ROLE_LABEL, PROJECT_ROLE_LABEL, type Project } from "@/entities/project";
import type { UserDirectory } from "@/entities/user";
import styles from "./admin.module.css";

export interface ProjectInfoDialogProps {
  project: Project | null;
  onClose: () => void;
  customer: Pick<Customer, "approvalEnabled">;
  users: UserDirectory;
  onEdit: (project: Project) => void;
  onMembers: (project: Project) => void;
}

/** 프로젝트 정보 (기획서 11.1): state, lead, approvers, participants with roles, requests in progress, templates. */
export function ProjectInfoDialog({ project: p, onClose, customer, users, onEdit, onMembers }: ProjectInfoDialogProps) {
  if (!p) return null;
  const approvers = p.members.filter((m) => m.roles.includes("APPROVER")).map((m) => users.name(m.userId));
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={p.name}
      description="프로젝트 정보"
      cancelLabel="닫기"
      foot={
        <div className={styles.foot}>
          <Button onClick={() => onEdit(p)}>수정</Button>
          <Button onClick={() => onMembers(p)}>구성원 관리</Button>
        </div>
      }
    >
      <KeyValueList
        items={[
          { label: "상태", value: p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag> },
          { label: LEAD_ROLE_LABEL, value: users.name(p.leadUserId) },
          {
            label: "승인자",
            value: customer.approvalEnabled ? approvers.join(", ") || "-" : "승인 단계 미사용",
          },
          { label: "진행 중 요청", value: `${p.activeRequestCount ?? 0}건` },
          {
            label: "알림톡 템플릿",
            value: p.templates.length ? p.templates.map((t) => `${t.name} (${t.code})`).join(", ") : "-",
          },
        ]}
      />
      <h3 className={styles.lbl}>{`구성원 ${p.members.length}명`}</h3>
      {p.members.length ? (
        <Table>
          <thead>
            <tr>
              <th>사용자</th>
              <th>역할</th>
            </tr>
          </thead>
          <tbody>
            {p.members.map((m) => (
              <tr key={m.userId}>
                <td className={tableClasses.ttl}>
                  {users.name(m.userId)}
                  <span className={styles.w}>{users.get(m.userId)?.dept ?? ""}</span>
                </td>
                <td>
                  {[
                    ...(m.userId === p.leadUserId ? [LEAD_ROLE_LABEL] : []),
                    ...m.roles.map((r) => PROJECT_ROLE_LABEL[r]),
                  ].join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className={styles.smallMuted}>구성원이 없습니다. 구성원 관리에서 추가하세요.</p>
      )}
    </Modal>
  );
}
