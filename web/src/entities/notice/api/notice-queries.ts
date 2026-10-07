import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type { Notice, NoticeUpsert } from "../model/types";

export const noticeKeys = {
  all: queryKeys.all("notices"),
  visible: (customerId: number) => queryKeys.list("notices", { customerId }),
  managed: (customerId: number) => queryKeys.list("notices", { customerId, manage: true }),
};

/** Notices the user may read in a customer (withdrawn excluded, newest first). */
export function useNotices(customerId: number | null) {
  return useQuery({
    queryKey: noticeKeys.visible(customerId ?? -1),
    queryFn: () => http.get<Notice[]>("/notices", { query: { customerId } }),
    enabled: customerId !== null,
  });
}

/** 공지 관리 list of a customer admin (withdrawn included, with logs). */
export function useManagedNotices(customerId: number | null) {
  return useQuery({
    queryKey: noticeKeys.managed(customerId ?? -1),
    queryFn: () => http.get<Notice[]>(`/customers/${customerId}/notices/manage`),
    enabled: customerId !== null,
  });
}

/** Customer admin notice writes (contract §10). Callers invalidate `noticeKeys.all` (and the dashboard). */
export const noticeApi = {
  create: (customerId: number, body: NoticeUpsert) => http.post<Notice>(`/customers/${customerId}/notices`, body),
  update: (id: number, body: NoticeUpsert) => http.patch<Notice>(`/notices/${id}`, body),
  withdraw: (id: number) => http.post<Notice>(`/notices/${id}/withdraw`),
};
