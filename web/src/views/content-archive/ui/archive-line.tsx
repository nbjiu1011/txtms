"use client";

import Link from "next/link";
import { formatDate } from "@/shared/lib";
import { Icon } from "@/shared/ui";
import { Button } from "@/shared/common";
import { RequestStatusChip, VariableText, type ArchiveLine } from "@/entities/request";
import { canCopyLine, lineMeta, lineToggleLabel } from "../model/archive-view-model";
import styles from "./content-archive.module.css";

export interface ArchiveLineItemProps {
  line: ArchiveLine;
  open: boolean;
  onToggle: () => void;
  onOpenRequest: (requestId: string) => void;
  onOpenContent: (requestId: string, contentKey: string) => void;
  onCopy: (line: ArchiveLine) => void;
  /** 후속 요청 (requesters of the project only); undefined hides the button. */
  onFollowUp?: (line: ArchiveLine) => void;
}

function RequestLink({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  return (
    <Link
      href={`/requests/${encodeURIComponent(id)}`}
      scroll={false}
      onNavigate={(e) => {
        e.preventDefault();
        onOpen(id);
      }}
    >
      {id}
    </Link>
  );
}

/**
 * One content line (reference `vContents` list item): the latest completed version first, its past
 * completions and open follow-up requests when expanded, and the line actions.
 */
export function ArchiveLineItem(props: ArchiveLineItemProps) {
  const { line, open, onToggle, onOpenRequest, onOpenContent, onCopy, onFollowUp } = props;
  const { latest } = line;
  const historyId = `archive-history-${line.lineKey}`;
  return (
    <div className={styles.item} role="listitem" aria-label={`${latest.title} v${latest.version}`}>
      <div className={styles.main}>
        <b>
          {latest.title} <span className={styles.ver}>v{latest.version}</span>
        </b>
        <span className={styles.meta}>{lineMeta(latest)}</span>
        <div className={styles.preview}>
          {/* reference `renderVars`: the raw text with variable chips (the resolved text is what 복사 copies) */}
          <VariableText text={latest.previewRaw} />
        </div>
        {open ? (
          <div className={styles.history} id={historyId}>
            {line.past.map((p) => (
              <div key={`${p.requestId}:${p.contentKey}`} className={styles.histRow}>
                과거 완료본 <RequestLink id={p.requestId} onOpen={onOpenRequest} /> {p.requestTitle} v{p.version}{" "}
                {formatDate(p.completedAt)}
              </div>
            ))}
            {line.followUps.map((f) => (
              <div key={f.requestId} className={styles.histRow}>
                후속 요청 <RequestLink id={f.requestId} onOpen={onOpenRequest} /> <RequestStatusChip status={f.status} />{" "}
                {f.title || "제목 없음"}
              </div>
            ))}
            {line.past.length === 0 && line.followUps.length === 0 ? (
              <div className={styles.histEmpty}>연결된 과거 완료본이나 후속 요청이 없습니다.</div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={styles.row}>
        <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={open ? historyId : undefined} onClick={onToggle}>
          {lineToggleLabel(line, open)}
        </Button>
        {canCopyLine(line) ? (
          <Button size="sm" onClick={() => onCopy(line)}>
            <Icon name="copy" />
            복사
          </Button>
        ) : null}
        <Button size="sm" onClick={() => onOpenContent(latest.requestId, latest.contentKey)}>
          <Icon name="ext" />새 탭
        </Button>
        {onFollowUp ? (
          <Button size="sm" onClick={() => onFollowUp(line)}>
            후속 요청
          </Button>
        ) : null}
      </div>
    </div>
  );
}
