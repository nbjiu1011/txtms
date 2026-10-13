/** Projects and project roles — contract §0.5, §2.2. */
export const PROJECT_ROLES = ["REQUESTER", "REVIEWER", "APPROVER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  REQUESTER: "요청자",
  REVIEWER: "검수자",
  APPROVER: "승인자",
};

/** Label of the derived role `project.leadUserId === me`. */
export const LEAD_ROLE_LABEL = "대표 검수자";

export interface ProjectTemplate {
  code: string;
  name: string;
}

export interface ProjectMember {
  userId: number;
  roles: ProjectRole[];
}

export interface Project {
  id: number;
  customerId: number;
  name: string;
  active: boolean;
  leadUserId: number | null;
  templates: ProjectTemplate[];
  members: ProjectMember[];
  variablesRevision: number;
  /**
   * Submitted, not final requests (`WAITING`…`APPROVAL_WAITING`) — only in the customer admin's
   * `GET /api/customers/{id}/projects` (contract §14.6); absent for members and operators.
   */
  activeRequestCount?: number;
  /** No requests, notices or variables and not the customer's last project — only in the 프로젝트 관리 list (§24). */
  deletable?: boolean;
}

/** Customer admin create/update payload (contract §11). */
export interface ProjectUpsert {
  name: string;
  leadUserId: number | null;
  approverIds: number[];
  active: boolean;
}
