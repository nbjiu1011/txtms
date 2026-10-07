import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Project, ProjectUpsert } from "../model/types";

export const projectKeys = {
  all: queryKeys.all("projects"),
  byCustomer: (customerId: number) => queryKeys.list("projects", { customerId }),
  detail: (id: number) => queryKeys.detail("projects", id),
};

export function fetchCustomerProjects(customerId: number): Promise<Project[]> {
  return http.get<Project[]>(`/customers/${customerId}/projects`);
}

export function fetchProject(id: number): Promise<Project> {
  return http.get<Project>(`/projects/${id}`);
}

/** Projects of a customer the current user belongs to (or administers). */
export function useCustomerProjects(customerId: number | null) {
  return useQuery({
    queryKey: projectKeys.byCustomer(customerId ?? -1),
    queryFn: () => fetchCustomerProjects(customerId as number),
    enabled: customerId !== null,
  });
}

/** One project (templates, senders, members, lead). */
export function useProject(id: number | null) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? -1),
    queryFn: () => fetchProject(id as number),
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });
}

/** Customer admin project writes (contract §11). Callers invalidate `projectKeys.all`. */
export const projectApi = {
  create: (customerId: number, body: ProjectUpsert) => http.post<Project>(`/customers/${customerId}/projects`, body),
  /** Partial update: omitted keys stay; `approverIds` replaces the approver set when present. */
  update: (projectId: number, body: Partial<ProjectUpsert>) => http.patch<Project>(`/projects/${projectId}`, body),
};
