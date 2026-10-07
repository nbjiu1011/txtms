import type { Project } from "@/entities/project";
import type { UserDirectory } from "@/entities/user";
import type { PerformanceProject } from "./performance-filter";

/** Projects the user may see performance of: all for a customer admin, else the projects they lead. */
export function permittedProjects(projects: Project[], admin: boolean, leadProjectIds: number[]): Project[] {
  return admin ? projects : projects.filter((p) => leadProjectIds.includes(p.id));
}

/**
 * 사용자 options: active reviewers of the target projects (one project or all permitted), user id
 * order — the same set as the server's personal rows.
 */
export function reviewerOptions(
  permitted: Project[],
  project: PerformanceProject,
  users: Pick<UserDirectory, "get">,
): { id: number; name: string }[] {
  const target = project === "all" ? permitted : permitted.filter((p) => p.id === project);
  const ids = new Set<number>();
  for (const p of target) {
    for (const m of p.members) if (m.roles.includes("REVIEWER")) ids.add(m.userId);
  }
  return [...ids]
    .sort((a, b) => a - b)
    .map((id) => users.get(id))
    .filter((u) => u !== undefined && u.active)
    .map((u) => ({ id: u!.id, name: u!.name }));
}
