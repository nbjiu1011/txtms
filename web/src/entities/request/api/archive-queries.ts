import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { http, queryKeys, type Page } from "@/shared/api";
import type { ArchiveLine, ArchiveListParams } from "../model/types";

export const archiveKeys = {
  all: queryKeys.all("archive"),
  list: (params: ArchiveListParams) => queryKeys.list("archive", params),
  campaigns: (projectId: number) => ["archive", "campaigns", projectId] as const,
};

/** Lines per archive page (contract default). */
export const ARCHIVE_PAGE_SIZE = 20;

/** Next page index of a lines page, or undefined on the last page ("더 보기" hidden). */
export function nextArchivePage(last: Pick<Page<ArchiveLine>, "page">): number | undefined {
  return last.page.number + 1 < last.page.totalPages ? last.page.number + 1 : undefined;
}

export function fetchArchiveContents(params: ArchiveListParams): Promise<Page<ArchiveLine>> {
  return http.get<Page<ArchiveLine>>("/archive/contents", { query: { ...params } });
}

/**
 * Completed content lines of a project (`GET /api/archive/contents`), newest completion first.
 * Pages are appended ("더 보기"); `params` excludes `page`.
 */
export function useArchiveContents(params: Omit<ArchiveListParams, "page"> | null) {
  return useInfiniteQuery({
    queryKey: archiveKeys.list({ size: ARCHIVE_PAGE_SIZE, ...(params ?? { projectId: -1 }) }),
    queryFn: ({ pageParam }) => fetchArchiveContents({ size: ARCHIVE_PAGE_SIZE, ...params!, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: nextArchivePage,
    enabled: params !== null,
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
