"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchRequestDetail, requestKeys, useRequests } from "@/entities/request";

/** Content shortcut listed in the add-tab popover. */
export interface RecentContent {
  requestId: string;
  contentKey: string;
  title: string;
}

const LIMIT = 8;

/**
 * First 8 contents of the requests visible in the current project (add-tab popover "콘텐츠").
 * The list endpoint has no content titles, so the details of the first requests are read
 * (only while the popover is open; details are cached).
 */
export function useRecentContents(projectId: number | null, enabled: boolean): RecentContent[] {
  const list = useRequests({ projectId: projectId ?? -1, page: 0, size: LIMIT }, enabled && projectId !== null);
  const ids = enabled ? (list.data?.content ?? []).map((r) => r.id) : [];
  const details = useQueries({
    queries: ids.map((id) => ({ queryKey: requestKeys.detail(id), queryFn: () => fetchRequestDetail(id) })),
  });
  const out: RecentContent[] = [];
  for (const q of details) {
    if (!q.data) continue;
    for (const c of q.data.contents) {
      if (out.length >= LIMIT) return out;
      out.push({ requestId: q.data.id, contentKey: c.key, title: c.title });
    }
  }
  return out;
}
