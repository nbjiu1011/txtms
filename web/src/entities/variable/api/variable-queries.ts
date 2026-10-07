import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Variable, VariableCreate, VariableLog, VariablePatch } from "../model/types";

export const variableKeys = {
  all: queryKeys.all("variables"),
  byProject: (projectId: number) => queryKeys.list("variables", { projectId }),
  logs: (id: number) => queryKeys.detail("variable-logs", id),
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

/** Change log of a variable, oldest first (customer admin; deleted variables too). */
export function useVariableLogs(id: number) {
  return useQuery({
    queryKey: variableKeys.logs(id),
    queryFn: () => http.get<VariableLog[]>(`/variables/${id}/logs`),
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
