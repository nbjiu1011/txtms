"use client";

import { Avatar, Button, Empty, Table, Tag } from "@/shared/ui";
import type { Project } from "@/entities/project";
import type { Member } from "@/entities/user";
import { memberRoleText } from "../model/member-rows";
import styles from "./admin-users.module.css";

export interface UsersTableProps {
  members: Member[];
  projects: Project[];
  busyId: number | null;
  onRoles: (m: Member) => void;
  onEmail: (m: Member) => void;
  onDeactivate: (m: Member) => void;
  onReactivate: (m: Member) => void;
  onReissue: (m: Member) => void;
}

/** 사용자와 역할 (reference `vUsers` + J:146 pending rows + J:238 이메일 button). */
export function UsersTable(props: UsersTableProps) {
  const { members, projects, busyId } = props;
  const pending = members.filter((m) => m.pending);
  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>사용자</th>
            <th>소속</th>
            <th>관리 권한</th>
            {projects.map((p) => (
              <th key={p.id}>{p.name}</th>
            ))}
            <th>상태</th>
            <th>
              <span className={styles.sr}>관리</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user.id}>
              <td>
                <span className={styles.user}>
                  <Avatar name={m.user.name} color={m.user.avatarColor} size={24} />
                  <span>
                    <b className={styles.name}>{m.user.name}</b>
                    <br />
                    <span className={styles.email}>{m.user.email}</span>
                  </span>
                </span>
              </td>
              {/* reference: an invited user without a department reads 초대 대기 */}
              <td>{m.user.dept ?? (m.pending ? "초대 대기" : "")}</td>
              <td className={styles.small}>
                {m.admin ? <Tag variant="fill">고객사 관리자</Tag> : <span className={styles.faint}>-</span>}
              </td>
              {projects.map((p) => (
                <td key={p.id} className={styles.small}>
                  {memberRoleText(m, p.id) ?? <span className={styles.faint}>-</span>}
                </td>
              ))}
              <td>{m.user.active ? <Tag>활성</Tag> : <Tag variant="hot">비활성</Tag>}</td>
              <td>
                <div className={styles.row}>
                  <Button size="sm" onClick={() => props.onRoles(m)}>
                    역할
                  </Button>
                  <Button size="sm" onClick={() => props.onEmail(m)}>
                    이메일
                  </Button>
                  {m.user.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === m.user.id}
                      onClick={() => props.onDeactivate(m)}
                    >
                      비활성화
                    </Button>
                  ) : !m.pending ? (
                    <Button size="sm" variant="ghost" disabled={busyId === m.user.id} onClick={() => props.onReactivate(m)}>
                      재활성화
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {pending.map((m) => (
            <tr key={`pending-${m.user.id}`}>
              <td colSpan={9}>
                {m.user.email} · 초대 대기{" "}
                <Button size="sm" disabled={busyId === m.user.id} onClick={() => props.onReissue(m)}>
                  초대 재발급
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {members.length === 0 ? <Empty title="사용자가 없습니다" /> : null}
    </>
  );
}
