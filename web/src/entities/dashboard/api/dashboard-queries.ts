import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Dashboard, Performance, PerformanceParams, WorkloadRow } from "../model/types";

export const dashboardKeys = {
  all: queryKeys.all("dashboard"),
  project: (projectId: number) => queryKeys.detail("dashboard", projectId),
  performance: (params: PerformanceParams) => queryKeys.list("performance", params),
};

/** Role dashboard of a project (`GET /api/projects/{id}/dashboard`). */
export function useDashboard(projectId: number | null) {
  return useQuery({
    queryKey: dashboardKeys.project(projectId ?? -1),
    queryFn: () => http.get<Dashboard>(`/projects/${projectId}/dashboard`),
    enabled: projectId !== null,
  });
}

/** Reviewer workload of a project (`GET /api/projects/{id}/workload`, lead or customer admin). */
export function useWorkload(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.detail("workload", projectId ?? -1),
    queryFn: () => http.get<WorkloadRow[]>(`/projects/${projectId}/workload`),
    enabled: enabled && projectId !== null,
  });
}

/** 업무량·실적 (`GET /api/performance`, lead of the projects or customer admin). Keeps the last result while a new filter loads. */
export function usePerformance(params: PerformanceParams | null) {
  return useQuery({
    queryKey: dashboardKeys.performance(params ?? { customerId: -1 }),
    queryFn: () => http.get<Performance>("/performance", { query: { ...params } }),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  });
}
