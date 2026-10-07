import type { MemberProject } from "@/entities/user";
import type { Project, ProjectRole } from "@/entities/project";

/** Checked roles per project id (`{projectId}:{role}` in the reference modal state). */
export type RoleMatrix = Record<number, ProjectRole[]>;

export function initialRoleMatrix(projects: Pick<Project, "id">[], memberships: MemberProject[]): RoleMatrix {
  const matrix: RoleMatrix = {};
  for (const p of projects) matrix[p.id] = [...(memberships.find((m) => m.projectId === p.id)?.roles ?? [])];
  return matrix;
}

export interface RoleCell {
  checked: boolean;
  disabled: boolean;
  /** Tooltip of a disabled box (reference `title`). */
  title?: string;
}

/**
 * Reference `roleEdit` cell rules: requester and reviewer exclude each other, the lead's reviewer
 * role cannot be removed here, approver only on approval customers. Re-evaluated on every change.
 */
export function roleCells(
  roles: ProjectRole[],
  lead: boolean,
  approvalEnabled: boolean,
): Record<ProjectRole, RoleCell> {
  const requester = roles.includes("REQUESTER");
  const reviewer = roles.includes("REVIEWER");
  return {
    REQUESTER: reviewer
      ? { checked: requester, disabled: true, title: "검수자 역할과 함께 줄 수 없습니다" }
      : { checked: requester, disabled: false },
    REVIEWER: { checked: reviewer, disabled: requester || lead },
    APPROVER: approvalEnabled
      ? { checked: roles.includes("APPROVER"), disabled: false }
      : { checked: roles.includes("APPROVER"), disabled: true, title: "승인 단계 미사용" },
  };
}

const ORDER: ProjectRole[] = ["REQUESTER", "REVIEWER", "APPROVER"];

export function toggleRole(roles: ProjectRole[], role: ProjectRole, on: boolean): ProjectRole[] {
  const next = on ? [...roles.filter((r) => r !== role), role] : roles.filter((r) => r !== role);
  return ORDER.filter((r) => next.includes(r));
}

/** First client-side problem (requester + reviewer together), else null. The rest is checked by the server. */
export function roleMatrixProblem(matrix: RoleMatrix): string | null {
  for (const roles of Object.values(matrix)) {
    if (roles.includes("REQUESTER") && roles.includes("REVIEWER")) return "요청자와 검수자는 함께 줄 수 없습니다";
  }
  return null;
}

/** Projects whose role set changed (`PUT …/project-roles` body; others stay as they are). */
export function changedProjects(
  matrix: RoleMatrix,
  memberships: MemberProject[],
): { projectId: number; roles: ProjectRole[] }[] {
  const changes: { projectId: number; roles: ProjectRole[] }[] = [];
  for (const [id, roles] of Object.entries(matrix)) {
    const projectId = Number(id);
    const before = ORDER.filter((r) => memberships.find((m) => m.projectId === projectId)?.roles.includes(r));
    const after = ORDER.filter((r) => roles.includes(r));
    if (before.join() !== after.join()) changes.push({ projectId, roles: after });
  }
  return changes;
}
