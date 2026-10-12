import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { ArchiveLine, ArchiveListParams } from "../model/types";

export const archiveKeys = {
  all: queryKeys.all("archive"),
  list: (params: ArchiveListParams) => queryKeys.list("archive", params),
  campaigns: (projectId: number) => ["archive", "campaigns", projectId] as const,
};

export function fetchArchiveContents(params: ArchiveListParams): Promise<Page<ArchiveLine>> {
  return http.get<Page<ArchiveLine>>("/archive/contents", { query: { ...params } });
}

/**
 * One page of the completed content lines of a project (`GET /api/archive/contents`), newest
 * completion first. Keeps the previous page while the next one (or new filters) loads.
 */
export function useArchiveContents(params: ArchiveListParams | null) {
  return useQuery({
    queryKey: archiveKeys.list(params ?? { projectId: -1 }),
    queryFn: () => fetchArchiveContents(params!),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  });
}

/** Campaign choices of the archive filter (campaigns of visible completed requests). */
export function useArchiveCampaigns(projectId: number | null) {
  return useQuery({
    queryKey: archiveKeys.campaigns(projectId ?? -1),
    queryFn: () => http.get<string[]>("/archive/campaigns", { query: { projectId: projectId! } }),
    enabled: projectId !== null,
    staleTime: 5 * 60_000,
  });
}
