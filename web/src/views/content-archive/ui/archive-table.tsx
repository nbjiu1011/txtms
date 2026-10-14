"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate } from "@/shared/lib";
import { Icon } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn, type DataTablePage } from "@/shared/common";
import { ContentTypeChip, RequestStatusChip, VariableText, type ArchiveLine } from "@/entities/request";
import { canCopyLine, lineHistoryCount, lineToggleLabel } from "../model/archive-view-model";
import styles from "./content-archive.module.css";

export interface ArchiveTableProps {
  lines: ArchiveLine[];
  /** Line keys whose history (past completions, follow-ups) is shown. */
  open: Record<string, boolean>;
  onToggle: (lineKey: string) => void;
  onOpenRequest: (requestId: string) => void;
  /** Row click: the latest completion's content tab. */
  onOpenContent: (requestId: string, contentKey: string) => void;
  /** The one row action. */
  onCopy: (line: ArchiveLine) => void;
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  empty?: ReactNode;
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

const historyId = (line: ArchiveLine) => `archive-history-${line.lineKey}`;

/**
 * Completed contents, one row per content line (latest completion first). A row click (or the title, by keyboard)
 * opens the content; 이력 unfolds the past completions and open follow-up requests under the preview; 복사 is the
 * one row action (text contents only).
 */
export function ArchiveTable(props: ArchiveTableProps) {
  const { lines, open, onToggle, onOpenRequest, onOpenContent, onCopy, page, onPage, loading, empty } = props;
  const columns: DataTableColumn<ArchiveLine>[] = [
    {
      id: "content",
      name: "콘텐츠",
      grow: 1,
      minWidth: "260px",
      wrap: true,
      rowAction: true,
      cell: (line) => (
        <div className={styles.main}>
          <RowLink
            onClick={() => onOpenContent(line.latest.requestId, line.latest.contentKey)}
            label={`${line.latest.title} v${line.latest.version} 열기`}
          >
            {line.latest.title} <span className={styles.ver}>v{line.latest.version}</span>
          </RowLink>
          <div className={styles.preview}>
            {/* reference `renderVars`: the raw text with variable chips (the resolved text is what 복사 copies) */}
            <VariableText text={line.latest.previewRaw} />
          </div>
          {open[line.lineKey] ? <LineHistory line={line} onOpenRequest={onOpenRequest} /> : null}
        </div>
      ),
    },
    {
      id: "request",
      name: "요청 ID",
      width: "128px",
      cell: (l) => <span className="whitespace-nowrap text-sub">{l.latest.requestId}</span>,
    },
    { id: "type", name: "유형", width: "96px", cell: (l) => <ContentTypeChip type={l.latest.type} showLabel /> },
    { id: "status", name: "상태", width: "104px", cell: (l) => <RequestStatusChip status={l.latest.status} /> },
    { id: "completed", name: "완료일", width: "84px", cell: (l) => formatDate(l.latest.completedAt) },
    { id: "campaign", name: "캠페인", width: "110px", cell: (l) => l.latest.campaign ?? "-" },
    {
      id: "history",
      name: "이력",
      width: "84px",
      rowAction: true,
      cell: (line) =>
        lineHistoryCount(line) === 0 ? (
          <span className={styles.faint}>없음</span>
        ) : (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={!!open[line.lineKey]}
            aria-controls={open[line.lineKey] ? historyId(line) : undefined}
            aria-label={`${line.latest.title} ${lineToggleLabel(line, !!open[line.lineKey])}`}
            onClick={() => onToggle(line.lineKey)}
          >
            {lineToggleLabel(line, !!open[line.lineKey])}
          </button>
        ),
    },
    {
      id: "copy",
      name: "복사",
      width: "84px",
      rowAction: true,
      cell: (line) =>
        canCopyLine(line) ? (
          <Button size="sm" aria-label={`${line.latest.title} 복사`} onClick={() => onCopy(line)}>
            <Icon name="copy" />
            복사
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      label="완료 콘텐츠"
      columns={columns}
      data={lines}
      keyField="lineKey"
      onRowClick={(line) => onOpenContent(line.latest.requestId, line.latest.contentKey)}
      page={page}
      onPage={onPage}
      loading={loading}
      empty={empty}
    />
  );
}

/** Past completions and open follow-up requests of a line, each linking its request. */
function LineHistory({ line, onOpenRequest }: { line: ArchiveLine; onOpenRequest: (id: string) => void }) {
  return (
    <ul className={styles.history} id={historyId(line)} aria-label={`${line.latest.title} 이력`}>
      {line.past.map((p) => (
        <li key={`${p.requestId}:${p.contentKey}`} className={styles.histRow}>
          과거 완료본 <RequestLink id={p.requestId} onOpen={onOpenRequest} /> {p.requestTitle} v{p.version}{" "}
          {formatDate(p.completedAt)}
        </li>
      ))}
      {line.followUps.map((f) => (
        <li key={f.requestId} className={styles.histRow}>
          후속 요청 <RequestLink id={f.requestId} onOpen={onOpenRequest} /> <RequestStatusChip status={f.status} />{" "}
          {f.title || "제목 없음"}
        </li>
      ))}
    </ul>
  );
}
