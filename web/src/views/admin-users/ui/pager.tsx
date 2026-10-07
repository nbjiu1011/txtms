import { Button } from "@/shared/ui";
import styles from "./admin-users.module.css";

export interface PagerProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

/** 이전 / 다음 for paged admin lists (hidden on a single page). */
export function Pager({ page, totalPages, onPage }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pager}>
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
