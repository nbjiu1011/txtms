"use client";

import { formatDateTime } from "@/shared/lib";
import { Empty } from "@/shared/ui";
import { Button, Seg } from "@/shared/common";
import {
  buildHistoryTimeline,
  historyTargetLabel,
  useRequestHistory,
  type HistoryFilter,
} from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./tabs.module.css";

export interface HistoryTabProps {
  requestId: string;
  users: UserDirectory;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
}

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "request", label: "요청 로그" },
  { key: "content", label: "콘텐츠 로그" },
];

/** 히스토리 sub tab — merged request/content log with round separators (reference `vHist`). */
export function HistoryTab({ requestId, users, filter, onFilter }: HistoryTabProps) {
  const history = useRequestHistory(requestId);
  const rows = history.data ? buildHistoryTimeline(history.data, filter) : [];
  return (
    <>
      <div className={styles.histTop}>
        <Seg label="히스토리 범위" options={FILTERS} value={filter} onChange={onFilter} />
        <span className={styles.faintSmall}>
          요청 로그와 콘텐츠 로그를 발생 시각순으로 합쳐 보여줍니다. 원본 로그의 기록 단위는 바뀌지 않습니다.
        </span>
      </div>
      {history.isPending ? (
        <Empty plain title="기록을 불러오는 중입니다" />
      ) : history.isError ? (
        <Empty
          plain
          title="기록을 불러오지 못했습니다"
          description={history.error.message}
          action={<Button onClick={() => void history.refetch()}>다시 시도</Button>}
        />
      ) : (
        <div className={styles.hist}>
          {rows.length === 0 ? <p className={styles.muted}>기록이 없습니다.</p> : null}
          {rows.map((row) =>
            row.kind === "round" ? (
              <div key={row.key} className={styles.rd}>
                {row.round}차 검수
              </div>
            ) : (
              <div key={row.key} className={row.content ? `${styles.hi} ${styles.c}` : styles.hi}>
                <div className={styles.hl}>
                  <b>{users.name(row.entry.actorId)}</b> {row.entry.action}
                </div>
                <div className={styles.hm}>
                  <span>{formatDateTime(row.entry.at)}</span>
                  <span>{historyTargetLabel(row.entry)}</span>
                </div>
                {row.entry.detail ? <div className={styles.hd}>{row.entry.detail}</div> : null}
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
