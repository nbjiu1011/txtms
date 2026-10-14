import { cn } from "@/shared/lib";
import { Button } from "./button";

export interface PagerProps {
  /** Zero-based page number. */
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

/** Page numbers shown around the current one (at most five). */
export function pageWindow(page: number, totalPages: number, size = 5): number[] {
  const start = Math.max(0, Math.min(page - Math.floor(size / 2), totalPages - size));
  return Array.from({ length: Math.min(size, totalPages) }, (_, i) => start + i);
}

/** 이전 · page numbers · 다음 under a paged list, with `n / N` (hidden on a single page). */
export function Pager({ page, totalPages, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="페이지"
      className="flex items-center justify-end gap-1 border-t border-line px-3.5 py-2.5 text-[12px] text-sub"
    >
      <span className="mr-2 tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        이전
      </Button>
      {pageWindow(page, totalPages).map((p) => (
        <button
          key={p}
          type="button"
          aria-label={`${p + 1} 페이지`}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          className={cn(
            "h-7 min-w-7 cursor-pointer rounded-md border-0 bg-transparent px-1.5 text-[12px] tabular-nums text-sub hover:bg-sunk hover:text-ink",
            p === page && "bg-navy font-semibold text-(--on-navy) hover:bg-navy hover:text-(--on-navy)",
          )}
        >
          {p + 1}
        </button>
      ))}
      <Button size="sm" variant="ghost" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        다음
      </Button>
    </nav>
  );
}
