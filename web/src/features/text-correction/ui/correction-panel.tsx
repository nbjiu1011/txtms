"use client";

import { useState } from "react";
import { Button, ReadOnlyBox } from "@/shared/ui";
import { useCorrectionDataset } from "@/entities/correction";
import { cardView } from "../model/card";
import { countRuns, type CorrectionRun } from "../model/run";
import type { CorrectionController, CorrectionRow } from "../model/use-correction";
import { CorrectionCard } from "./correction-card";
import { SuggestionDialog, type SuggestionTarget } from "./suggestion-dialog";
import styles from "./correction.module.css";

/** Shown for a content with attachments: correction checks the text entered in TMS, never the files. */
export const FILES_NOTE = "첨부파일 내용은 교정 대상이 아닙니다. 입력한 문안만 검사합니다.";
export const STALE_NOTE = "최신 내용과 불일치 · 문안, 변수 또는 연결값이 바뀌었습니다. 다시 검사하세요.";

export interface CorrectionPanelProps {
  requestId: string;
  correction: CorrectionController;
  /** Content shown in the editor. */
  currentKey: string;
  /** ④ 건의하기 (EDIT_CONTENT or REVIEW). */
  canSuggest: boolean;
}

/**
 * 교정 tab of the side panel: check buttons and dataset line (reference `vProof`), the current
 * content's result, or every content's result grouped after 전체 검사 with the bottom bar.
 */
export function CorrectionPanel({ requestId, correction, currentKey, canSuggest }: CorrectionPanelProps) {
  const dataset = useCorrectionDataset(requestId);
  const [suggest, setSuggest] = useState<SuggestionTarget | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const current = correction.row(currentKey);
  const missing = dataset.data ? !dataset.data.assigned : false;
  const total = correction.bulk?.length ?? 0;

  const cards = (row: CorrectionRow, run: CorrectionRun) =>
    run.groups.length === 0 ? (
      <div className={styles.emptySm}>교정할 표현이 없습니다.</div>
    ) : (
      run.groups.map((group) => (
        <CorrectionCard
          key={group.id}
          contentKey={row.content.key}
          group={group}
          view={cardView(run, group, { editable: correction.canEdit(row.content.key), stale: row.stale })}
          canSuggest={canSuggest}
          onApply={(index) => void correction.apply(row.content.key, group.id, index)}
          onRestore={() => void correction.restore(row.content.key, group.id)}
          onSuggest={() => setSuggest({ contentKey: row.content.key, group })}
          onReveal={() => correction.reveal(row.content.key, group.id)}
        />
      ))
    );

  const stale = (row: CorrectionRow) =>
    row.stale ? (
      <div className={styles.stale} role="status">
        {STALE_NOTE}
      </div>
    ) : null;

  const head = (
    <div className={styles.head}>
      <div className={styles.actions}>
        <Button
          size="sm"
          aria-disabled={missing || undefined}
          disabled={!current || correction.checking !== null}
          onClick={() => void correction.checkOne(currentKey)}
        >
          {correction.checking === "one" ? "검사 중" : "이 콘텐츠 검사"}
        </Button>
        {correction.contentCount > 1 ? (
          <Button
            size="sm"
            aria-disabled={missing || undefined}
            disabled={correction.checking !== null}
            onClick={() => void correction.checkAll()}
          >
            {correction.checking === "all" ? "검사 중" : `전체 검사 ${correction.contentCount}건`}
          </Button>
        ) : null}
      </div>
      <p className={styles.note}>
        교정 데이터셋 ·{" "}
        {missing ? (
          <span className={styles.need}>배정 필요</span>
        ) : (
          (dataset.data?.datasetLabel ?? (dataset.isError ? "확인하지 못했습니다" : "확인 중"))
        )}
        <br />
        교정 실행은 검수 요청·완료 조건이 아닙니다.
      </p>
      {current?.hasFiles ? <ReadOnlyBox className={styles.note}>{FILES_NOTE}</ReadOnlyBox> : null}
    </div>
  );

  const bulkRows = (correction.bulk ?? []).map((key) => correction.row(key)).filter((r): r is CorrectionRow => r !== null);
  const bulkRuns = bulkRows.flatMap((r) => (r.run ? [r.run] : []));
  const counts = countRuns(bulkRuns);

  return (
    <>
      {head}
      {correction.bulk ? (
        <>
          {bulkRows.map((row) => {
            const key = row.content.key;
            const open = !collapsed.has(key);
            return (
              <section key={key} className={styles.group} aria-label={`${key} 교정 결과`}>
                <button
                  type="button"
                  className={styles.groupHead}
                  aria-expanded={open}
                  data-current={key === currentKey || undefined}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (open) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                >
                  <span className={styles.caret} aria-hidden="true">
                    {open ? "▼" : "▶"}
                  </span>
                  <span className={styles.groupTitle}>
                    {key} · {row.content.title}
                  </span>
                  <span className={styles.count}>({row.run?.groups.length ?? 0})</span>
                </button>
                {open ? (
                  row.run ? (
                    <>
                      {stale(row)}
                      {cards(row, row.run)}
                    </>
                  ) : (
                    <div className={styles.emptySm}>아직 검사하지 않았습니다.</div>
                  )
                ) : null}
              </section>
            );
          })}
          <div className={styles.bar}>
            <div className={styles.barCounts} aria-live="polite">
              <span>
                콘텐츠 <b>{bulkRuns.length}</b>
              </span>
              <span>
                교정 적용 <b>{counts.applied}</b>
              </span>
              <span>
                교정 결과 <b>{counts.results}</b>
              </span>
            </div>
            <Button size="sm" title={`전체 검사 ${total}건의 결과를 닫습니다`} onClick={correction.closeBulk}>
              교정 완료
            </Button>
          </div>
        </>
      ) : current?.run ? (
        <>
          <div className={styles.lbl}>
            {currentKey} · {current.content.title}
          </div>
          {stale(current)}
          {cards(current, current.run)}
        </>
      ) : (
        <div className={styles.empty}>아직 검사하지 않았습니다.</div>
      )}
      <SuggestionDialog requestId={requestId} target={suggest} onClose={() => setSuggest(null)} />
    </>
  );
}
