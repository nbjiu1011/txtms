import type { Project, ProjectUpsert } from "@/entities/project";
import { firstMissing } from "@/shared/lib";

export interface ProjectForm {
  name: string;
  /** Selected lead user id as the select value ('' = 선택). */
  leadUserId: string;
  approverIds: number[];
  active: boolean;
}

/** Edit starts from the project (approvers = members with APPROVER); a new project from blanks, 사용 중. */
export function initialProjectForm(project: Project | null): ProjectForm {
  if (!project) return { name: "", leadUserId: "", approverIds: [], active: true };
  return {
    name: project.name,
    leadUserId: project.leadUserId === null ? "" : String(project.leadUserId),
    approverIds: project.members.filter((m) => m.roles.includes("APPROVER")).map((m) => m.userId),
    active: project.active,
  };
}

/**
 * Reference `projEdit` checks in order (first problem as a toast): required name and lead, a lead
 * holding the requester role of this project, approvers required on approval customers.
 */
export function projectFormProblem(form: ProjectForm, project: Project | null, approvalEnabled: boolean): string | null {
  const missing = firstMissing([
    [form.name, "프로젝트 이름"],
    [form.leadUserId, "대표 검수자"],
  ]);
  if (missing) return missing;
  const lead = Number(form.leadUserId);
  const leadRoles = project?.members.find((m) => m.userId === lead)?.roles ?? [];
  if (leadRoles.includes("REQUESTER")) return "요청자 역할을 가진 사용자는 대표 검수자가 될 수 없습니다";
  if (approvalEnabled && form.approverIds.length === 0) return "승인자를 한 명 이상 지정하세요";
  return null;
}

/** Contract body (`approverIds` only on approval customers — the server refuses them otherwise). */
export function projectBody(form: ProjectForm, approvalEnabled: boolean): ProjectUpsert {
  return {
    name: form.name.trim(),
    leadUserId: form.leadUserId ? Number(form.leadUserId) : null,
    approverIds: approvalEnabled ? form.approverIds : [],
    active: form.active,
  };
}
