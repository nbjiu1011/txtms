import { LEAD_ROLE_LABEL, PROJECT_ROLE_LABEL } from "@/entities/project";
import type { Member } from "@/entities/user";

/** Role text of a member in a project column: roles in order, `대표 검수자` last; null when none. */
export function memberRoleText(member: Pick<Member, "projects">, projectId: number): string | null {
  const entry = member.projects.find((p) => p.projectId === projectId);
  if (!entry) return null;
  const labels = entry.roles.map((r) => PROJECT_ROLE_LABEL[r]);
  if (entry.lead) labels.push(LEAD_ROLE_LABEL);
  return labels.length ? labels.join(", ") : null;
}
