"use client";

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from "react";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { correctionApi, type CorrectionCheckItem } from "@/entities/correction";
import {
  getPayloadField,
  normalizePayload,
  setPayloadField,
  type ContentPayload,
  type ContentType,
} from "@/entities/request";
import { isStale, payloadSnapshot } from "./freshness";
import { handoffKey, useCorrectionHandoff, type CorrectionHandoff } from "./handoff";
import {
  commitReplacement,
  createRun,
  planApply,
  planRestore,
  replaceText,
  type CorrectionRun,
  type GroupState,
} from "./run";

export const APPLIED_MESSAGE = "교정이 적용되었습니다.";
export const RESTORED_MESSAGE = "교정이 취소되었습니다.";
export const STALE_MESSAGE = "최신 내용과 불일치합니다. 다시 검사하세요";

/** How this tab edits contents (draft autosave or the review-time revision buffer). */
export interface CorrectionEditor {
  /** Payload as this tab shows it (local edits over the server copy); null for an unknown key. */
  payloadOf(key: string): ContentPayload | null;
  /** The viewer may change this content in this tab now. */
  canEdit(key: string): boolean;
  /**
   * Gets ready to edit (review time: opens the buffer and takes the edit lock). Resolves false when
   * refused — the editor has already told the user why.
   */
  begin(key: string): Promise<boolean>;
  /** Writes the payload into the tab's edit state (draft: autosaved; review: revision buffer). */
  write(key: string, payload: ContentPayload): void;
}

/** A content of the request as the panel needs it. */
export interface CorrectionContent {
  key: string;
  title: string;
  fileCount: number;
}

/** Where to show an expression: select `[start, end)` of `field` in the editor of `key`. */
export interface RevealTarget {
  key: string;
  groupId: string;
  field: string;
  start: number;
  end: number;
}

export interface UseCorrectionOptions {
  requestId: string;
  type: ContentType;
  contents: readonly CorrectionContent[];
  /** Current project `variablesRevision` (null while unknown). */
  variablesRevision: number | null;
  editor: CorrectionEditor;
  /** Card click / after apply: show the expression (switch content or tab, select the range). */
  onReveal: (target: RevealTarget, run: CorrectionRun) => void;
  /** A check saw a newer variables revision than the project copy: refetch the project. */
  onVariablesAhead?: () => void;
  /** Content tab: adopts results handed over for this content by another tab. */
  adoptFor?: string;
}

/** Row of the panel: a checked content or one without a result yet. */
export interface CorrectionRow {
  content: CorrectionContent;
  /** The content has attachments (checked anyway: only the entered text, never the files). */
  hasFiles: boolean;
  run: CorrectionRun | null;
  stale: boolean;
}

export interface CorrectionController {
  checking: "one" | "all" | null;
  /** Full-check mode: content keys of the last 전체 검사. */
  bulk: readonly string[] | null;
  row: (key: string) => CorrectionRow | null;
  /** Contents of the request (전체 검사 checks all of them). */
  contentCount: number;
  checkOne: (key: string) => Promise<void>;
  checkAll: () => Promise<void>;
  closeBulk: () => void;
  apply: (key: string, groupId: string, optionIndex: number) => Promise<void>;
  restore: (key: string, groupId: string) => Promise<void>;
  /** Card click: select the expression in the editor. */
  reveal: (key: string, groupId: string) => void;
  canEdit: (key: string) => boolean;
}

interface TabCorrection {
  runs: Record<string, CorrectionRun>;
  bulk: string[] | null;
}

function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

function targetOf(key: string, g: GroupState): RevealTarget {
  return { key, groupId: g.id, field: g.field, start: g.start, end: g.end };
}

/**
 * Text correction state of one work tab (tab memory, contract §13): results per content, the
 * full-check mode, and apply/restore editing the tab's buffer before recording the history event.
 */
export function useCorrection(options: UseCorrectionOptions): CorrectionController {
  const { requestId, type, contents, variablesRevision, editor } = options;
  const [state, setState] = useState<TabCorrection>({ runs: {}, bulk: null });
  const [checking, setChecking] = useState<"one" | "all" | null>(null);
  const latest = useRef({ state, options });
  // Layout effect, not a passive one: a click right after new results render must already see them,
  // otherwise apply/restore read the previous state and silently do nothing.
  useLayoutEffect(() => {
    latest.current = { state, options };
  });
  const busy = useRef(false);

  // A result handed over by another tab (content tab of `adoptFor`): adopt it, then show the card's
  // expression and clear the hand-over.
  const adoptFor = options.adoptFor;
  const handoff = useCorrectionHandoff((s) => (adoptFor ? s.items[handoffKey(requestId, adoptFor)] : undefined));
  const [adopted, setAdopted] = useState<CorrectionHandoff | undefined>(undefined);
  if (handoff && adoptFor && handoff !== adopted) {
    setAdopted(handoff);
    setState((s) => ({ ...s, runs: { ...s.runs, [adoptFor]: handoff.run } }));
  }
  useEffect(() => {
    if (!adopted || !adoptFor) return;
    useCorrectionHandoff.getState().consume(requestId, adoptFor);
    const group = adopted.run.groups.find((g) => g.id === adopted.groupId);
    if (group) latest.current.options.onReveal(targetOf(adoptFor, group), adopted.run);
  }, [adopted, adoptFor, requestId]);

  const staleOf = useCallback(
    (run: CorrectionRun, key: string) => {
      const payload = editor.payloadOf(key);
      return payload === null || isStale(run, payloadSnapshot(type, payload), variablesRevision);
    },
    [editor, type, variablesRevision],
  );

  const runCheck = async (keys: string[], bulk: boolean) => {
    const { editor: ed } = latest.current.options;
    const items: CorrectionCheckItem[] = [];
    const snapshots = new Map<string, string>();
    for (const key of keys) {
      const payload = ed.payloadOf(key);
      if (payload === null) continue;
      const normalized = normalizePayload(type, payload);
      snapshots.set(key, payloadSnapshot(type, normalized));
      items.push({ contentKey: key, payload: normalized });
    }
    if (items.length === 0) {
      if (bulk) setState((s) => ({ ...s, bulk: keys }));
      return;
    }
    setChecking(bulk ? "all" : "one");
    try {
      const { results } = await correctionApi.check(requestId, items);
      setState((s) => {
        const runs = { ...s.runs };
        for (const result of results) runs[result.contentKey] = createRun(result, snapshots.get(result.contentKey) ?? "");
        return { runs, bulk: bulk ? keys : s.bulk };
      });
      const known = latest.current.options.variablesRevision;
      if (results.some((r) => known === null || r.variablesRevision > known)) latest.current.options.onVariablesAhead?.();
    } catch (error) {
      toast(messageOf(error, "교정을 실행하지 못했습니다"));
    } finally {
      setChecking(null);
    }
  };

  const edit = async (key: string, groupId: string, optionIndex: number | null) => {
    if (busy.current) return;
    const { state: current, options: opts } = latest.current;
    const run = current.runs[key];
    const ed = opts.editor;
    if (!run || !ed.canEdit(key)) return;
    const plan = (payload: ContentPayload) => {
      const text = getPayloadField(normalizePayload(type, payload), run.groups.find((g) => g.id === groupId)?.field ?? "");
      const fieldText = typeof text === "string" ? text : "";
      return optionIndex === null ? planRestore(run, groupId, fieldText) : planApply(run, groupId, optionIndex, fieldText);
    };
    const before = ed.payloadOf(key);
    if (before === null || isStale(run, payloadSnapshot(type, before), opts.variablesRevision)) {
      toast(STALE_MESSAGE);
      return;
    }
    const first = plan(before);
    if (!first.ok) {
      toast(first.message);
      return;
    }
    busy.current = true;
    try {
      if (!(await ed.begin(key))) return;
      const payload = ed.payloadOf(key);
      const planned = payload === null ? first : plan(payload);
      if (payload === null || !planned.ok) {
        toast(planned.ok ? STALE_MESSAGE : planned.message);
        return;
      }
      const r = planned.replacement;
      const normalized = normalizePayload(type, payload);
      const fieldText = String(getPayloadField(normalized, r.field) ?? "");
      const next = setPayloadField(normalized, r.field, replaceText(fieldText, r));
      ed.write(key, next);
      const nextRun = commitReplacement(run, r, payloadSnapshot(type, next));
      setState((s) => ({ ...s, runs: { ...s.runs, [key]: nextRun } }));
      toast(optionIndex === null ? RESTORED_MESSAGE : APPLIED_MESSAGE);
      const group = nextRun.groups.find((g) => g.id === groupId);
      if (group) opts.onReveal(targetOf(key, group), nextRun);
      // the rule applied, or — for a restore — the rule that was in place (history detail `({ruleId})`, §14.4)
      const prior = run.groups.find((g) => g.id === groupId);
      const ruleIndex = optionIndex ?? prior?.applied ?? null;
      const ruleId = ruleIndex === null ? undefined : prior?.options[ruleIndex]?.ruleId;
      void correctionApi
        .event(requestId, {
          contentKey: key,
          action: optionIndex === null ? "RESTORE" : "APPLY",
          field: r.field,
          before: r.before,
          after: r.after,
          ...(ruleId ? { ruleId } : {}),
        })
        .catch((error: unknown) => toast(messageOf(error, "교정 이력을 남기지 못했습니다")));
    } finally {
      busy.current = false;
    }
  };

  const row = (key: string): CorrectionRow | null => {
    const content = contents.find((c) => c.key === key);
    if (!content) return null;
    const run = state.runs[key] ?? null;
    return { content, hasFiles: content.fileCount > 0, run, stale: run ? staleOf(run, key) : false };
  };

  return {
    checking,
    bulk: state.bulk,
    row,
    contentCount: contents.length,
    checkOne: (key) => runCheck([key], false),
    checkAll: () => runCheck(contents.map((c) => c.key), true),
    closeBulk: () => setState((s) => ({ ...s, bulk: null })),
    apply: (key, groupId, optionIndex) => edit(key, groupId, optionIndex),
    restore: (key, groupId) => edit(key, groupId, null),
    reveal: (key, groupId) => {
      const run = state.runs[key];
      const group = run?.groups.find((g) => g.id === groupId);
      if (run && group) options.onReveal(targetOf(key, group), run);
    },
    canEdit: (key) => editor.canEdit(key),
  };
}
