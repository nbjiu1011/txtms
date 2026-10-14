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
 * Role cell rules: requester and reviewer exclude each other, but both boxes stay clickable — ticking one clears
 * the other ({@link toggleRole}), so switching a member does not need two steps. The lead's reviewer role cannot be
 * removed here (the server refuses it), so the lead's reviewer box is locked and so is the requester box (ticking it
 * would clear the reviewer role). Approver only on approval customers. Re-evaluated on every change.
 */
export function roleCells(
  roles: ProjectRole[],
  lead: boolean,
  approvalEnabled: boolean,
): Record<ProjectRole, RoleCell> {
  const requester = roles.includes("REQUESTER");
  const reviewer = roles.includes("REVIEWER");
  return {
    REQUESTER: lead
      ? { checked: requester, disabled: true, title: "대표 검수자는 요청자 역할을 함께 가질 수 없습니다" }
      : { checked: requester, disabled: false, title: reviewer ? "선택하면 검수자 역할이 해제됩니다" : undefined },
    REVIEWER: lead
      ? { checked: reviewer, disabled: true, title: "대표 검수자는 프로젝트 수정에서 바꾸세요" }
      : { checked: reviewer, disabled: false, title: requester ? "선택하면 요청자 역할이 해제됩니다" : undefined },
    APPROVER: approvalEnabled
      ? { checked: roles.includes("APPROVER"), disabled: false }
      : { checked: roles.includes("APPROVER"), disabled: true, title: "승인 단계 미사용" },
  };
}

const ORDER: ProjectRole[] = ["REQUESTER", "REVIEWER", "APPROVER"];

/** The other role of the requester/reviewer pair, which ticking a role clears. */
const EXCLUDES: Partial<Record<ProjectRole, ProjectRole>> = { REQUESTER: "REVIEWER", REVIEWER: "REQUESTER" };

export function toggleRole(roles: ProjectRole[], role: ProjectRole, on: boolean): ProjectRole[] {
  const cleared = on ? roles.filter((r) => r !== role && r !== EXCLUDES[role]) : roles.filter((r) => r !== role);
  const next = on ? [...cleared, role] : cleared;
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
