"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, Modal, Table, tableClasses, toast } from "@/shared/ui";
import type { Customer } from "@/entities/customer";
import { PROJECT_ROLES, type Project } from "@/entities/project";
import { memberApi, type Member } from "@/entities/user";
import { invalidateUserData } from "../model/invalidate";
import {
  changedProjects,
  initialRoleMatrix,
  roleCells,
  roleMatrixProblem,
  toggleRole,
  type RoleMatrix,
} from "../model/role-matrix";
import { useServerError } from "../model/server-error";

export interface RoleEditDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Pick<Customer, "id" | "approvalEnabled">;
  projects: Project[];
  member: Member | null;
}

const ROLE_COLUMN_LABEL = { REQUESTER: "요청자", REVIEWER: "검수자", APPROVER: "승인자" } as const;

/** `{이름} 역할 관리` (reference `roleEdit`): project × role checkboxes with live exclusivity. */
export function RoleEditDialog(props: RoleEditDialogProps) {
  if (!props.open || !props.member) return null;
  return <RoleEditBody {...props} member={props.member} />;
}

function RoleEditBody({ onClose, customer, projects, member }: RoleEditDialogProps & { member: Member }) {
  const client = useQueryClient();
  const [matrix, setMatrix] = useState<RoleMatrix>(() => initialRoleMatrix(projects, member.projects));
  const server = useServerError("역할을 저장하지 못했습니다");

  const submit = async () => {
    const problem = roleMatrixProblem(matrix);
    if (problem) {
      toast(problem);
      return false;
    }
    const changes = changedProjects(matrix, member.projects);
    if (changes.length === 0) return undefined;
    server.clear();
    try {
      await memberApi.setProjectRoles(customer.id, member.user.id, changes);
    } catch (error) {
      return server.fail(error);
    }
    await invalidateUserData(client);
    return undefined;
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`${member.user.name} 역할 관리`}
      description="요청자와 검수자 역할은 함께 줄 수 없습니다. 대표 검수자는 프로젝트 관리에서 지정합니다."
      okLabel="저장"
      onOk={submit}
    >
      <Table>
        <thead>
          <tr>
            <th>프로젝트</th>
            <th>요청자</th>
            <th>검수자</th>
            <th>승인자</th>
            <th>대표 검수자</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const lead = p.leadUserId === member.user.id;
            const cells = roleCells(matrix[p.id] ?? [], lead, customer.approvalEnabled);
            return (
              <tr key={p.id}>
                <td className={tableClasses.ttl}>{p.name}</td>
                {PROJECT_ROLES.map((role) => (
                  <td key={role}>
                    <input
                      type="checkbox"
                      aria-label={`${p.name} ${ROLE_COLUMN_LABEL[role]}`}
                      checked={cells[role].checked}
                      disabled={cells[role].disabled}
                      title={cells[role].title}
                      onChange={(e) =>
                        setMatrix((m) => ({ ...m, [p.id]: toggleRole(m[p.id] ?? [], role, e.target.checked) }))
                      }
                    />
                  </td>
                ))}
                <td>{lead ? "예" : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
