"use client";

import { useRequests } from "@/entities/request";

/** Content shortcut listed in the add-tab popover. */
export interface RecentContent {
  requestId: string;
  contentKey: string;
  title: string;
}

const LIMIT = 8;

/**
 * First 8 contents of the requests visible in the current project (add-tab popover "콘텐츠"),
 * from the `contents` of the list summaries (one call, only while the popover is open).
 */
export function useRecentContents(projectId: number | null, enabled: boolean): RecentContent[] {
  const list = useRequests({ projectId: projectId ?? -1, page: 0, size: LIMIT }, enabled && projectId !== null);
  if (!enabled) return [];
  const out: RecentContent[] = [];
  for (const r of list.data?.content ?? []) {
    for (const c of r.contents ?? []) {
      if (out.length >= LIMIT) return out;
      out.push({ requestId: r.id, contentKey: c.key, title: c.title });
    }
  }
  return out;
}
