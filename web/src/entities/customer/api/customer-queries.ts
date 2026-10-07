import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Customer } from "../model/types";

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
