import { useCallback, useLayoutEffect, useState } from "react";

/** Rows per page of the server-paged work lists (contract default `size`). */
export const LIST_PAGE_SIZE = 20;

/** Zero-based page kept inside `[0, totalPages - 1]` (page 0 when the list is empty). */
export function clampPage(page: number, totalPages: number): number {
  return Math.max(0, Math.min(page, totalPages - 1));
}

/**
 * Zero-based page of a server-paged list. It goes back to page 0 whenever `resetKey` changes (the
 * filters, project or view of the list), without an extra request for the old page.
 */
export function useListPage(resetKey: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key: resetKey, page: 0 });
  const page = state.key === resetKey ? state.page : 0;
  const setPage = useCallback((next: number) => setState({ key: resetKey, page: next }), [resetKey]);
  return [page, setPage];
}

/**
 * Moves to the last available page when the current one no longer exists (the last row of the
 * last page left the list after a change). Pass `undefined` while the total is unknown or comes
 * from placeholder data of another page. Runs before paint so the empty page never shows.
 */
export function useClampPage(page: number, totalPages: number | undefined, setPage: (page: number) => void): void {
  useLayoutEffect(() => {
    if (totalPages === undefined) return;
    const next = clampPage(page, totalPages);
    if (next !== page) setPage(next);
  }, [page, totalPages, setPage]);
}
