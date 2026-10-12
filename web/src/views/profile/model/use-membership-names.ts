"use client";

import { useQueries } from "@tanstack/react-query";
import type { Customer } from "@/entities/customer";
import type { Me } from "@/entities/me";
import { fetchCustomerProjects, projectKeys } from "@/entities/project";

/**
 * Project and customer names for the profile's role list: the projects of every customer the user has a
 * membership in (same cache as the top bar's project list) and the accessible customers.
 */
export function useMembershipNames(me: Me | null, customers: readonly Customer[]) {
  const customerIds = [...new Set((me?.memberships ?? []).map((m) => m.customerId))];
  const results = useQueries({
    queries: customerIds.map((customerId) => ({
      queryKey: projectKeys.byCustomer(customerId),
      queryFn: () => fetchCustomerProjects(customerId),
    })),
  });
  const projectNames = new Map<number, string>();
  for (const result of results) for (const p of result.data ?? []) projectNames.set(p.id, p.name);
  const customerNames = new Map(customers.map((c) => [c.id, c.name]));
  return { projectNames, customerNames };
}
