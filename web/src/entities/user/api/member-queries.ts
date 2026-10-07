import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { ProjectRole } from "@/entities/project/@x/user";
import type { DeactivationImpact, Member, MemberInvite } from "../model/types";

export const memberKeys = {
  all: queryKeys.all("members"),
  byCustomer: (customerId: number) => queryKeys.list("members", { customerId }),
  impact: (customerId: number, userId: number) => queryKeys.detail("deactivation-impact", `${customerId}:${userId}`),
};

/** Users of a customer with roles, pending invitations and inactive accounts (customer admin). */
export function useCustomerMembers(customerId: number | null) {
  return useQuery({
    queryKey: memberKeys.byCustomer(customerId ?? -1),
    queryFn: () => http.get<Member[]>(`/customers/${customerId}/members`),
    enabled: customerId !== null,
  });
}

/** What deactivating a user would touch (requests to hand over, blocking work, lead projects). */
export function useDeactivationImpact(customerId: number, userId: number | null) {
  return useQuery({
    queryKey: memberKeys.impact(customerId, userId ?? -1),
    queryFn: () => http.get<DeactivationImpact>(`/customers/${customerId}/users/${userId}/deactivation-impact`),
    enabled: userId !== null,
    staleTime: 0,
  });
}

const user = (customerId: number, userId: number) => `/customers/${customerId}/users/${userId}`;

/** Customer admin user writes (contract §11). Callers invalidate `memberKeys.all` and the user lists. */
export const memberApi = {
  deactivationImpact: (customerId: number, userId: number) =>
    http.get<DeactivationImpact>(`${user(customerId, userId)}/deactivation-impact`),
  invite: (customerId: number, body: MemberInvite) => http.post<Member>(`/customers/${customerId}/invitations`, body),
  reissueInvitation: (customerId: number, userId: number) =>
    http.post<void>(`${user(customerId, userId)}/invitation/reissue`),
  changeEmail: (customerId: number, userId: number, email: string, externalDomainConfirmed: boolean) =>
    http.patch<Member>(`${user(customerId, userId)}/email`, { email, externalDomainConfirmed }),
  /** Replaces the roles of the listed projects only (an empty list removes the membership). */
  setProjectRoles: (customerId: number, userId: number, projects: { projectId: number; roles: ProjectRole[] }[]) =>
    http.put<Member>(`${user(customerId, userId)}/project-roles`, { projects }),
  deactivate: (customerId: number, userId: number, body: { substituteUserId: number | null; handover: string }) =>
    http.post<void>(`${user(customerId, userId)}/deactivate`, body),
  reactivate: (customerId: number, userId: number) => http.post<void>(`${user(customerId, userId)}/reactivate`),
};
