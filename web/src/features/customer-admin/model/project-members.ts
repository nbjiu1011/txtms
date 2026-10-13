import type { Project, ProjectMember } from "@/entities/project";

/** One participant row of the 구성원 modal: a user and the roles checked for this project. */
export type MemberRow = ProjectMember;

/** Current members of the project, the lead first. */
export function initialMemberRows(project: Pick<Project, "members" | "leadUserId">): MemberRow[] {
  const rows = project.members.map((m) => ({ userId: m.userId, roles: [...m.roles] }));
  return [...rows.filter((r) => r.userId === project.leadUserId), ...rows.filter((r) => r.userId !== project.leadUserId)];
}

/** Adds a user without roles (the admin checks them next); a listed user is left as is. */
export function addMemberRow(rows: MemberRow[], userId: number): MemberRow[] {
  return rows.some((r) => r.userId === userId) ? rows : [...rows, { userId, roles: [] }];
}

export function removeMemberRow(rows: MemberRow[], userId: number): MemberRow[] {
  return rows.filter((r) => r.userId !== userId);
}

/**
 * First client-side problem, in the server's order: requester and reviewer together, a row without roles, no approver
 * on an approval customer. The rest (requests in progress) is checked by the server.
 */
export function memberRowsProblem(rows: MemberRow[], approvalEnabled: boolean): string | null {
  if (rows.some((r) => r.roles.includes("REQUESTER") && r.roles.includes("REVIEWER"))) {
    return "요청자와 검수자는 함께 줄 수 없습니다";
  }
  if (rows.some((r) => r.roles.length === 0)) return "추가한 구성원의 역할을 하나 이상 선택하세요";
  if (approvalEnabled && !rows.some((r) => r.roles.includes("APPROVER"))) return "승인자를 한 명 이상 지정하세요";
  return null;
}

const key = (rows: MemberRow[]) =>
  rows
    .map((r) => `${r.userId}:${[...r.roles].sort().join(",")}`)
    .sort()
    .join("|");

/** Whether saving would change anything (a no-op save just closes). */
export function memberRowsChanged(rows: MemberRow[], project: Pick<Project, "members">): boolean {
  return key(rows) !== key(project.members);
}
