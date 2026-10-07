"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Input, Select } from "@/shared/ui";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  EMPTY_REQUEST_FILTERS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABEL,
  type ContentType,
  type RequestFilters,
  type RequestStatus,
} from "@/entities/request";
import type { UserSummary } from "@/entities/user";
import styles from "./request-list.module.css";

/** Delay before the title/ID search is sent. */
export const SEARCH_DEBOUNCE_MS = 250;

export interface RequestFilterBarProps {
  value: RequestFilters;
  onChange: (next: RequestFilters) => void;
  lead: UserSummary | null;
  reviewers: UserSummary[];
}

const toId = (v: string): number | null => (v === "" ? null : Number(v));

/** `.filters` — every control of the reference request list filter (text search debounced). */
export function RequestFilterBar({ value, onChange, lead, reviewers }: RequestFilterBarProps) {
  const [q, setQ] = useState(value.q);
  const set = (patch: Partial<RequestFilters>) => onChange({ ...value, ...patch });

  // Debounced search: other controls apply at once.
  useEffect(() => {
    if (q === value.q) return;
    const timer = window.setTimeout(() => onChange({ ...value, q }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, value, onChange]);

  return (
    <div className={styles.filters} role="search" aria-label="요청 검색 조건">
      <div className={`${styles.f} ${styles.fq}`}>
        <label htmlFor="flt-q">제목 또는 요청 ID</label>
        <Input
          id="flt-q"
          className={styles.ctl}
          placeholder="검색어 입력"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className={styles.f}>
        <label htmlFor="flt-type">유형</label>
        <Select
          id="flt-type"
          className={styles.ctl}
          value={value.type}
          onChange={(e) => set({ type: e.target.value as ContentType | "" })}
        >
          <option value="">전체</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className={styles.f}>
        <label htmlFor="flt-status">요청 상태</label>
        <Select
          id="flt-status"
          className={styles.ctl}
          value={value.status}
          onChange={(e) => set({ status: e.target.value as RequestStatus | "" })}
        >
          <option value="">전체</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <PersonSelect id="flt-lead" label="대표 검수자" people={lead ? [lead] : []} value={value.leadUserId} onChange={(v) => set({ leadUserId: v })} />
      <PersonSelect id="flt-primary" label="주담당 검수자" people={reviewers} value={value.primaryReviewerId} onChange={(v) => set({ primaryReviewerId: v })} />
      <PersonSelect id="flt-rv" label="배정 검수자" people={reviewers} value={value.reviewerId} onChange={(v) => set({ reviewerId: v })} />
      <DateRange
        label="확정 납기"
        from={value.dueFrom}
        to={value.dueTo}
        onChange={(dueFrom, dueTo) => set({ dueFrom, dueTo })}
      />
      <DateRange
        label="접수일"
        from={value.submittedFrom}
        to={value.submittedTo}
        onChange={(submittedFrom, submittedTo) => set({ submittedFrom, submittedTo })}
      />
      <Checkbox
        label="내 담당만"
        labelClassName={styles.mine}
        checked={value.mine}
        onChange={(e) => set({ mine: e.target.checked })}
      />
      <Button
        size="sm"
        variant="ghost"
        className={styles.reset}
        onClick={() => {
          setQ("");
          onChange(EMPTY_REQUEST_FILTERS);
        }}
      >
        초기화
      </Button>
    </div>
  );
}

function PersonSelect(props: {
  id: string;
  label: string;
  people: UserSummary[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className={styles.f}>
      <label htmlFor={props.id}>{props.label}</label>
      <Select
        id={props.id}
        className={styles.ctl}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(toId(e.target.value))}
      >
        <option value="">전체</option>
        {props.people.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function DateRange(props: { label: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className={styles.f} role="group" aria-label={props.label}>
      <label>{props.label}</label>
      <div className={styles.range}>
        <Input
          type="date"
          className={styles.ctl}
          aria-label={`${props.label} 시작`}
          value={props.from}
          onChange={(e) => props.onChange(e.target.value, props.to)}
        />
        <span className={styles.tilde}>~</span>
        <Input
          type="date"
          className={styles.ctl}
          aria-label={`${props.label} 끝`}
          value={props.to}
          onChange={(e) => props.onChange(props.from, e.target.value)}
        />
      </div>
    </div>
  );
}
