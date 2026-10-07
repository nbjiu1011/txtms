import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type {
  ContentType,
  ContentTypeSetting,
  ContentVersion,
  HistoryEntry,
  RequestDetail,
  RequestListParams,
  RequestSummary,
  WritingGuide,
} from "../model/types";

export const requestKeys = {
  all: queryKeys.all("requests"),
  list: (params: RequestListParams) => queryKeys.list("requests", params),
  detail: (id: string) => queryKeys.detail("requests", id),
  history: (id: string) => ["requests", "history", id] as const,
  version: (id: string, key: string, version: number) => ["requests", "version", id, key, version] as const,
  image: (id: string, imageKey: string) => ["requests", "image", id, imageKey] as const,
};

export function fetchRequests(params: RequestListParams): Promise<Page<RequestSummary>> {
  return http.get<Page<RequestSummary>>("/requests", { query: { ...params } });
}

export function fetchRequestDetail(id: string): Promise<RequestDetail> {
  return http.get<RequestDetail>(`/requests/${encodeURIComponent(id)}`);
}

/** Page of requests (`GET /api/requests`). Keeps the previous page while the filters change. */
export function useRequests(params: RequestListParams, enabled = true) {
  return useQuery({
    queryKey: requestKeys.list(params),
    queryFn: () => fetchRequests(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** `totalElements` of a list query (badge counts): one row is fetched. */
export function useRequestTotal(params: RequestListParams, enabled = true) {
  const sized = { ...params, page: 0, size: 1 };
  return useQuery({
    queryKey: requestKeys.list(sized),
    queryFn: () => fetchRequests(sized),
    enabled,
    select: (page) => page.page.totalElements,
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function useRequestDetail(id: string, enabled = true) {
  return useQuery({ queryKey: requestKeys.detail(id), queryFn: () => fetchRequestDetail(id), enabled: enabled && !!id });
}

export function useRequestHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: requestKeys.history(id),
    queryFn: () => http.get<HistoryEntry[]>(`/requests/${encodeURIComponent(id)}/history`),
    enabled: enabled && !!id,
  });
}

export function useContentVersion(id: string, key: string, version: number | null) {
  return useQuery({
    queryKey: requestKeys.version(id, key, version ?? -1),
    queryFn: () =>
      http.get<ContentVersion>(
        `/requests/${encodeURIComponent(id)}/contents/${encodeURIComponent(key)}/versions/${version}`,
      ),
    enabled: version !== null,
    staleTime: Infinity,
  });
}

/** Contract download/export paths (binary endpoints, fetched with the bearer token). */
export const requestFilePaths = {
  fileVersion: (id: string, key: string, fileId: number, version: number) =>
    `/requests/${encodeURIComponent(id)}/contents/${encodeURIComponent(key)}/files/${fileId}/versions/${version}/download`,
  bundleXlsx: (id: string) => `/requests/${encodeURIComponent(id)}/bundle/export.xlsx`,
  bundleZip: (id: string) => `/requests/${encodeURIComponent(id)}/bundle/attachments.zip`,
};

/** Content type settings (`active`, `mockEnabled`). */
export function useContentTypes() {
  return useQuery({
    queryKey: queryKeys.list("content-types", {}),
    queryFn: () => http.get<ContentTypeSetting[]>("/content-types"),
    staleTime: 10 * 60_000,
  });
}

/** Read-only writing guide of a content type. */
export function useWritingGuide(type: ContentType, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.detail("guides", type),
    queryFn: () => http.get<WritingGuide>(`/guides/${type}`),
    enabled,
    staleTime: 10 * 60_000,
  });
}
