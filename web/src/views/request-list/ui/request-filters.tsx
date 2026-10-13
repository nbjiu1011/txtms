"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  DateRangeFilter,
  FilterBar,
  FilterField,
  Input,
  Select,
  filterClasses,
} from "@/shared/common";
import {
  OFFERED_CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  EMPTY_REQUEST_FILTERS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABEL,
  type ContentType,
  type RequestFilters,
  type RequestStatus,
} from "@/entities/request";
import type { UserSummary } from "@/entities/user";

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
    <FilterBar label="요청 검색 조건">
      <FilterField label="제목 또는 요청 ID" htmlFor="flt-q" grow>
        <Input
          id="flt-q"
          className={filterClasses.control}
          placeholder="검색어 입력"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </FilterField>
      <FilterField label="유형" htmlFor="flt-type">
        <Select
          id="flt-type"
          className={filterClasses.control}
          value={value.type}
          onChange={(e) => set({ type: e.target.value as ContentType | "" })}
        >
          <option value="">전체</option>
          {OFFERED_CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="요청 상태" htmlFor="flt-status">
        <Select
          id="flt-status"
          className={filterClasses.control}
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
      </FilterField>
      <PersonSelect id="flt-lead" label="대표 검수자" people={lead ? [lead] : []} value={value.leadUserId} onChange={(v) => set({ leadUserId: v })} />
      <PersonSelect id="flt-primary" label="주담당 검수자" people={reviewers} value={value.primaryReviewerId} onChange={(v) => set({ primaryReviewerId: v })} />
      <PersonSelect id="flt-rv" label="배정 검수자" people={reviewers} value={value.reviewerId} onChange={(v) => set({ reviewerId: v })} />
      <DateRangeFilter
        label="확정 납기"
        from={value.dueFrom}
        to={value.dueTo}
        onChange={(dueFrom, dueTo) => set({ dueFrom, dueTo })}
      />
      <DateRangeFilter
        label="접수일"
        from={value.submittedFrom}
        to={value.submittedTo}
        onChange={(submittedFrom, submittedTo) => set({ submittedFrom, submittedTo })}
      />
      <Checkbox
        label="내 담당만"
        labelClassName={filterClasses.check}
        checked={value.mine}
        onChange={(e) => set({ mine: e.target.checked })}
      />
      <Button
        size="sm"
        variant="ghost"
        className={filterClasses.reset}
        onClick={() => {
          setQ("");
          onChange(EMPTY_REQUEST_FILTERS);
        }}
      >
        초기화
      </Button>
    </FilterBar>
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
    <FilterField label={props.label} htmlFor={props.id}>
      <Select
        id={props.id}
        className={filterClasses.control}
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
    </FilterField>
  );
}
