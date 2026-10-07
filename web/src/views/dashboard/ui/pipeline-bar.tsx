import type { CSSProperties } from "react";
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, type RequestStatus } from "@/entities/request";
import type { PipelineItem } from "@/entities/dashboard";
import styles from "./dashboard.module.css";

export interface PipelineBarProps {
  projectName: string;
  total: number;
  stages: PipelineItem[];
  onSelect: (status: RequestStatus) => void;
}

/** Navy project flow card: proportional bar + stage counts (reference `vPipe`). */
export function PipelineBar({ projectName, total, stages, onSelect }: PipelineBarProps) {
  const sum = stages.reduce((n, s) => n + s.count, 0) || 1;
  return (
    <section className={styles.pipe} aria-label="프로젝트 요청 흐름">
      <div className={styles.pipeH}>
        <b>{projectName} 요청 흐름</b>
        <span>{total}건</span>
      </div>
      <div className={styles.pipeBar} aria-hidden="true">
        {stages
          .filter((s) => s.count > 0)
          .map((s) => (
            <i
              key={s.status}
              className={styles[REQUEST_STATUS_TONE[s.status]]}
              style={{ "--flex": s.count / sum } as CSSProperties}
            />
          ))}
      </div>
      <div className={styles.pipeSteps}>
        {stages.map((s) => (
          <button key={s.status} type="button" className={styles.pipeS} onClick={() => onSelect(s.status)}>
            <span className={styles.pipeN}>{s.count}</span>
            <span className={styles.pipeL}>
              <i className={`${styles.dot} ${styles[REQUEST_STATUS_TONE[s.status]]}`} />
              {REQUEST_STATUS_LABEL[s.status]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
