import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { Project, ProjectMember, ProjectUpsert } from "../model/types";

export const projectKeys = {
  all: queryKeys.all("projects"),
  byCustomer: (customerId: number) => queryKeys.list("projects", { customerId }),
  managed: (customerId: number, page: number, size: number) =>
    queryKeys.list("projects", { customerId, manage: true, page, size }),
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

/** One page of the 프로젝트 관리 list (customer admin): stopped projects included, with `activeRequestCount`. */
export function useManagedProjects(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: projectKeys.managed(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<Project>>(`/customers/${customerId}/projects/manage`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** One project (알림톡 templates, members, lead). */
export function useProject(id: number | null) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? -1),
    queryFn: () => fetchProject(id as number),
    enabled: id !== null,
    staleTime: 5 * 60_000,
  });
}

/** Customer admin project writes (contract §11, §24). Callers invalidate `projectKeys.all`. */
export const projectApi = {
  create: (customerId: number, body: ProjectUpsert) => http.post<Project>(`/customers/${customerId}/projects`, body),
  /** Partial update: omitted keys stay; `approverIds` replaces the approver set when present. */
  update: (projectId: number, body: Partial<ProjectUpsert>) => http.patch<Project>(`/projects/${projectId}`, body),
  /** The whole participation: listed users get exactly these roles, other members are removed. */
  setMembers: (projectId: number, members: ProjectMember[]) =>
    http.put<Project>(`/projects/${projectId}/members`, { members }),
  /** Only a project without history (`deletable`). */
  remove: (projectId: number) => http.delete<void>(`/projects/${projectId}`),
};
