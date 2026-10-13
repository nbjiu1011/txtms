"use client";

import { useEffect, useState } from "react";
import { Button, DateRangeFilter, FilterBar, FilterField, Input, Select, filterClasses } from "@/shared/common";
import { OFFERED_CONTENT_TYPES, CONTENT_TYPE_LABEL, REQUEST_STATUS_LABEL, type ContentType, type FinalStatus } from "@/entities/request";
import { ARCHIVE_STATUS_OPTIONS, EMPTY_ARCHIVE_FILTERS, type ArchiveFilters } from "../model/archive-view-model";
import styles from "./content-archive.module.css";

/** Delay before the text search is sent. */
export const ARCHIVE_SEARCH_DEBOUNCE_MS = 250;

export interface ArchiveFilterBarProps {
  value: ArchiveFilters;
  onChange: (next: ArchiveFilters) => void;
  campaigns: readonly string[];
}

/** Archive filters (reference `vContents` `.filters`): text search is debounced, the rest apply at once. */
export function ArchiveFilterBar({ value, onChange, campaigns }: ArchiveFilterBarProps) {
  const [q, setQ] = useState(value.q);
  const set = (patch: Partial<ArchiveFilters>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (q === value.q) return;
    const timer = window.setTimeout(() => onChange({ ...value, q }), ARCHIVE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, value, onChange]);

  return (
    <FilterBar label="콘텐츠 검색 조건">
      <FilterField label="문안, 파일명, 본문" htmlFor="arc-q" grow className={styles.qField}>
        <Input
          id="arc-q"
          className={filterClasses.control}
          placeholder="검색어"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </FilterField>
      <FilterField label="유형" htmlFor="arc-type">
        <Select
          id="arc-type"
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
      <FilterField label="캠페인" htmlFor="arc-camp">
        <Select
          id="arc-camp"
          className={filterClasses.control}
          value={value.campaign}
          onChange={(e) => set({ campaign: e.target.value })}
        >
          <option value="">전체</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="요청 상태" htmlFor="arc-status">
        <Select
          id="arc-status"
          className={filterClasses.control}
          value={value.status}
          onChange={(e) => set({ status: e.target.value as FinalStatus | "" })}
        >
          <option value="">전체</option>
          {ARCHIVE_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </FilterField>
      <DateRangeFilter label="완료일" from={value.from} to={value.to} onChange={(from, to) => set({ from, to })} />
      <Button
        size="sm"
        variant="ghost"
        className={filterClasses.reset}
        onClick={() => {
          setQ("");
          onChange(EMPTY_ARCHIVE_FILTERS);
        }}
      >
        초기화
      </Button>
    </FilterBar>
  );
}
