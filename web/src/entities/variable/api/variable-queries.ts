import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { ProjectVariableLog, Variable, VariableCreate, VariablePatch } from "../model/types";

export const variableKeys = {
  all: queryKeys.all("variables"),
  byProject: (projectId: number) => queryKeys.list("variables", { projectId }),
  /** 변수 관리 list (deleted variables included), one page. */
  adminByProject: (projectId: number, page: number, size: number) =>
    queryKeys.list("variables", { projectId, manage: true, page, size }),
  logsAll: queryKeys.all("variable-logs"),
  projectLogs: (projectId: number) => queryKeys.list("variable-logs", { projectId }),
};

/**
 * Variables of a project (`GET /api/projects/{id}/variables`). Used for previews; when the call
 * fails the caller renders raw `#{key}` tokens, so failures are not retried.
 */
export function useProjectVariables(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: variableKeys.byProject(projectId ?? -1),
    queryFn: () => http.get<Variable[]>(`/projects/${projectId}/variables`),
    enabled: enabled && projectId !== null,
    retry: false,
    staleTime: 60_000,
  });
}

/** One page of the 변수 관리 list (customer admin): deleted variables included (reference 삭제 (이력 보존) rows). */
export function useAdminVariables(projectId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: variableKeys.adminByProject(projectId ?? -1, page, size),
    queryFn: () => http.get<Page<Variable>>(`/projects/${projectId}/variables/manage`, { query: { page, size } }),
    enabled: projectId !== null,
    placeholderData: keepPreviousData,
  });
}

/** Change log of every variable of a project, newest first (customer admin, one call for the table). */
export function useProjectVariableLogs(projectId: number | null) {
  return useQuery({
    queryKey: variableKeys.projectLogs(projectId ?? -1),
    queryFn: () => http.get<ProjectVariableLog[]>(`/projects/${projectId}/variable-logs`),
    enabled: projectId !== null,
  });
}

/** Registers a project variable (any project member, contract §7). */
export function createVariable(projectId: number, body: VariableCreate): Promise<Variable> {
  return http.post<Variable>(`/projects/${projectId}/variables`, body);
}

/** Customer admin variable writes (contract §7). Callers invalidate `variableKeys.all` and the project. */
export const variableApi = {
  create: createVariable,
  update: (id: number, patch: VariablePatch) => http.patch<Variable>(`/variables/${id}`, patch),
  /** Logical delete (history kept, key stays reserved); refused while the variable is in use. */
  remove: (id: number) => http.delete<void>(`/variables/${id}`),
};
