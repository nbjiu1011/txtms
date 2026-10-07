import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { AuditLog, OutboxMail } from "../model/types";

export const auditKeys = {
  outbox: (customerId: number, page: number, size: number) => queryKeys.list("outbox", { customerId, page, size }),
  outboxAll: queryKeys.all("outbox"),
  customerLogs: (customerId: number, page: number, size: number) =>
    queryKeys.list("audit-logs", { customerId, page, size }),
  logsAll: queryKeys.all("audit-logs"),
};

/** Mail outbox of a customer (customer admin; token links masked unless demo sample customer). */
export function useCustomerOutbox(customerId: number | null, page = 0, size = 20) {
  return useQuery({
    queryKey: auditKeys.outbox(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<OutboxMail>>(`/customers/${customerId}/outbox`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** Audit log of a customer, newest first (customer admin). */
export function useCustomerAuditLogs(customerId: number | null, page = 0, size = 20) {
  return useQuery({
    queryKey: auditKeys.customerLogs(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<AuditLog>>(`/customers/${customerId}/audit-logs`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}
