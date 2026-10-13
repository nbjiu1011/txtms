import { Button } from "./button";

export interface PagerProps {
  /** Zero-based page number. */
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

/** 이전 / 다음 under a paged list (hidden on a single page). */
export function Pager({ page, totalPages, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line px-3.5 py-2.5 text-[12px] text-sub">
      <span>
        {page + 1} / {totalPages}
      </span>
      <Button size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        이전
      </Button>
      <Button size="sm" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        다음
      </Button>
    </div>
  );
}
