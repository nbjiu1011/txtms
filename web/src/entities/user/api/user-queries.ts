import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { UserSummary } from "../model/types";

export const userKeys = {
  byCustomer: (customerId: number) => queryKeys.list("users", { customerId }),
};

export function fetchCustomerUsers(customerId: number): Promise<UserSummary[]> {
  return http.get<UserSummary[]>(`/customers/${customerId}/users`);
}

/** Users of a customer (names and avatar colors for display). */
export function useCustomerUsers(customerId: number | null) {
  return useQuery({
    queryKey: userKeys.byCustomer(customerId ?? -1),
    queryFn: () => fetchCustomerUsers(customerId as number),
    enabled: customerId !== null,
    staleTime: 5 * 60_000,
  });
}
