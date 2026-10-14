"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, Icon, Table, Tag, tableClasses, toast } from "@/shared/ui";
import { Button, IconButton, Modal, Select, useServerError } from "@/shared/common";
import type { Customer } from "@/entities/customer";
import { LEAD_ROLE_LABEL, PROJECT_ROLES, PROJECT_ROLE_LABEL, projectApi, type Project } from "@/entities/project";
import type { UserSummary } from "@/entities/user";
import { invalidateUserData } from "../model/invalidate";
import {
  addMemberRow,
  initialMemberRows,
  memberRowsChanged,
  memberRowsProblem,
  removeMemberRow,
  type MemberRow,
} from "../model/project-members";
import { roleCells, toggleRole } from "../model/role-matrix";
import styles from "./admin.module.css";

export interface ProjectMembersDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Pick<Customer, "id" | "approvalEnabled">;
  project: Project | null;
  /** Users of the customer (active ones can be added). */
  users: UserSummary[];
}

/**
 * `{프로젝트} 구성원` — the project's participation (기획서 11.1 참여 범위, contract §24): who takes part with which
 * roles. Adding a user, changing roles and 제외 are saved together; the lead reviewer is changed in 수정.
 */
export function ProjectMembersDialog(props: ProjectMembersDialogProps) {
  if (!props.open || !props.project) return null;
  return <ProjectMembersBody {...props} project={props.project} />;
}

function ProjectMembersBody({ onClose, customer, project, users }: ProjectMembersDialogProps & { project: Project }) {
  const id = useId();
  const client = useQueryClient();
  const [rows, setRows] = useState<MemberRow[]>(() => initialMemberRows(project));
  const [adding, setAdding] = useState("");
  const server = useServerError("구성원을 저장하지 못했습니다");
  const userOf = (userId: number) => users.find((u) => u.id === userId);
  const candidates = users.filter((u) => u.active && !rows.some((r) => r.userId === u.id));

  const submit = async () => {
    const problem = memberRowsProblem(rows, customer.approvalEnabled);
    if (problem) {
      toast(problem);
      return false;
    }
    if (!memberRowsChanged(rows, project)) return undefined;
    server.clear();
    try {
      await projectApi.setMembers(project.id, rows);
    } catch (error) {
      return server.fail(error);
    }
    await invalidateUserData(client);
    toast("구성원을 저장했습니다");
    return undefined;
  };

  const add = () => {
    if (!adding) return;
    setRows((r) => addMemberRow(r, Number(adding)));
    setAdding("");
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`${project.name} 구성원`}
      description="프로젝트에 참여할 사용자와 역할을 정합니다. 요청자와 검수자는 둘 중 하나만 줄 수 있어 하나를 고르면 다른 하나가 해제되고, 대표 검수자는 프로젝트 수정에서 바꿉니다."
      okLabel="저장"
      onOk={submit}
    >
      <div className={styles.addRow}>
        <Select
          id={`${id}-add`}
          aria-label="추가할 사용자"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        >
          <option value="">추가할 사용자 선택</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.name}  ${u.dept ?? ""}`}
            </option>
          ))}
        </Select>
        <Button onClick={add} aria-disabled={!adding || undefined}>
          추가
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <th>사용자</th>
            {PROJECT_ROLES.map((role) => (
              <th key={role}>{PROJECT_ROLE_LABEL[role]}</th>
            ))}
            <th>
              <span className={styles.sr}>제외</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const user = userOf(row.userId);
            const name = user?.name ?? "-";
            const lead = row.userId === project.leadUserId;
            const cells = roleCells(row.roles, lead, customer.approvalEnabled);
            return (
              <tr key={row.userId}>
                <td className={tableClasses.ttl}>
                  {name} {lead ? <Tag>{LEAD_ROLE_LABEL}</Tag> : null}
                  {user && !user.active ? <Tag variant="hot">비활성</Tag> : null}
                  <span className={styles.w}>{user?.dept ?? ""}</span>
                </td>
                {PROJECT_ROLES.map((role) => (
                  <td key={role}>
                    <input
                      type="checkbox"
                      aria-label={`${name} ${PROJECT_ROLE_LABEL[role]}`}
                      checked={cells[role].checked}
                      disabled={cells[role].disabled}
                      title={cells[role].title}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((r) =>
                            r.userId === row.userId ? { ...r, roles: toggleRole(r.roles, role, e.target.checked) } : r,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  {/* removing a row is local until 저장: immediate, with the shared remove look */}
                  <IconButton
                    label={`${name} 제외`}
                    aria-disabled={lead || undefined}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
                    title={lead ? "대표 검수자는 프로젝트 수정에서 먼저 바꾸세요" : undefined}
                    onClick={() => {
                      if (!lead) setRows((rs) => removeMemberRow(rs, row.userId));
                    }}
                  >
                    <Icon name="x" />
                  </IconButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {rows.length === 0 ? <p className={styles.smallMuted}>구성원이 없습니다.</p> : null}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
