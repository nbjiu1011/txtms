import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Variable } from "../model/types";

export const variableKeys = {
  byProject: (projectId: number) => queryKeys.list("variables", { projectId }),
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
