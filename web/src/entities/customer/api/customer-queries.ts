import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Customer, CustomerSettingsPatch } from "../model/types";

export const customerKeys = {
  all: queryKeys.all("customers"),
  accessible: () => queryKeys.list("customers", { scope: "accessible" }),
};

export function fetchCustomers(): Promise<Customer[]> {
  return http.get<Customer[]>("/customers");
}

/** Customers the current user can access (own, administered; all for operators). */
export function useCustomers(enabled = true) {
  return useQuery({ queryKey: customerKeys.accessible(), queryFn: fetchCustomers, enabled });
}

/** Customer admin settings (`PATCH /api/customers/{id}/settings`; domain and approval usage are read-only). */
export function updateCustomerSettings(customerId: number, patch: Partial<CustomerSettingsPatch>): Promise<Customer> {
  return http.patch<Customer>(`/customers/${customerId}/settings`, patch);
}
