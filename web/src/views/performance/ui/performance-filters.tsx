"use client";

import { useId } from "react";
import { DateRangePicker, FilterBar, FilterField, Select, filterClasses } from "@/shared/common";
import type { Project } from "@/entities/project";
import {
  PERIOD_OPTIONS,
  type PerformanceFilter,
  type PerformancePeriod,
} from "../model/performance-filter";

export interface PerformanceFiltersProps {
  value: PerformanceFilter;
  onChange: (next: PerformanceFilter) => void;
  projects: Project[];
  reviewers: { id: number; name: string }[];
}

/**
 * Reference `vPerf` filters + J: 기간 (접수일 KST), 접수일 직접 지정 (one period field; cleared = the preset above),
 * 프로젝트 (+권한 있는 전체), 사용자.
 */
export function PerformanceFilters({ value, onChange, projects, reviewers }: PerformanceFiltersProps) {
  const id = useId();
  const set = (patch: Partial<PerformanceFilter>) => onChange({ ...value, ...patch });
  return (
    <FilterBar label="실적 조회 조건">
      <FilterField label="기간 (접수일 KST)" htmlFor={`${id}-period`}>
        <Select
          id={`${id}-period`}
          className={filterClasses.control}
          value={value.period}
          onChange={(e) => set({ period: e.target.value as PerformancePeriod })}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="접수일 직접 지정" htmlFor={`${id}-range`}>
        <DateRangePicker
          id={`${id}-range`}
          className={filterClasses.control}
          placeholder="지정 안 함 (기간 기준)"
          from={value.from}
          to={value.to}
          onChange={(from, to) => set({ from, to })}
        />
      </FilterField>
      <FilterField label="프로젝트" htmlFor={`${id}-project`}>
        <Select
          id={`${id}-project`}
          className={filterClasses.control}
          value={String(value.project)}
          onChange={(e) => set({ project: e.target.value === "all" ? "all" : Number(e.target.value) })}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="all">권한 있는 전체</option>
        </Select>
      </FilterField>
      <FilterField label="사용자" htmlFor={`${id}-user`}>
        <Select
          id={`${id}-user`}
          className={filterClasses.control}
          value={value.userId === null ? "" : String(value.userId)}
          onChange={(e) => set({ userId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">전체</option>
          {reviewers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </FilterField>
    </FilterBar>
  );
}
