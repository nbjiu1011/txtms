import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { Notice, NoticeUpsert } from "../model/types";

export const noticeKeys = {
  all: queryKeys.all("notices"),
  detail: (id: number) => queryKeys.detail("notices", id),
  visible: (customerId: number, page: number, size: number) => queryKeys.list("notices", { customerId, page, size }),
  managed: (customerId: number, page: number, size: number) =>
    queryKeys.list("notices", { customerId, manage: true, page, size }),
};

/** One page of the notices the user may read in a customer (withdrawn excluded, newest first). */
export function useNotices(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: noticeKeys.visible(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<Notice>>("/notices", { query: { customerId, page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** One page of the 공지 관리 list of a customer admin (withdrawn included, with logs). */
export function useManagedNotices(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: noticeKeys.managed(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<Notice>>(`/customers/${customerId}/notices/manage`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** One notice (detail pages): readable like the list; the customer's admins also read withdrawn ones. */
export function useNotice(id: number | null) {
  return useQuery({
    queryKey: noticeKeys.detail(id ?? -1),
    queryFn: () => http.get<Notice>(`/notices/${id}`),
    enabled: id !== null,
  });
}

/** Customer admin notice writes (contract §10). Callers invalidate `noticeKeys.all` (and the dashboard). */
export const noticeApi = {
  create: (customerId: number, body: NoticeUpsert) => http.post<Notice>(`/customers/${customerId}/notices`, body),
  update: (id: number, body: NoticeUpsert) => http.patch<Notice>(`/notices/${id}`, body),
  withdraw: (id: number) => http.post<Notice>(`/notices/${id}/withdraw`),
};
