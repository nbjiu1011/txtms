import type { NoticeSummary } from "./types";

/**
 * Scope text of a notice row (reference `scopeLabel`): `프로젝트 공지  {프로젝트명}` / `고객사 전체 공지`.
 * The two spaces are the reference separator (collapsed by normal white-space).
 */
export function noticeScopeText(
  notice: Pick<NoticeSummary, "scope" | "projectId">,
  projectName: (id: number) => string | undefined,
): string {
  if (notice.scope === "CUSTOMER") return "고객사 전체 공지";
  const name = notice.projectId === null ? "" : (projectName(notice.projectId) ?? "");
  return `프로젝트 공지  ${name}`.trimEnd();
}
