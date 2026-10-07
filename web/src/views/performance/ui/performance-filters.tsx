"use client";

import { useId } from "react";
import { FilterBar, FilterField, Input, Select, filterClasses } from "@/shared/ui";
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

/** Reference `vPerf` filters + J: 기간 (접수일 KST), 접수일 직접 지정, 프로젝트 (+권한 있는 전체), 사용자. */
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
      <FilterField label="접수일 직접 지정">
        <div className={filterClasses.range}>
          <Input
            type="date"
            className={filterClasses.control}
            aria-label="집계 시작일"
            value={value.from}
            onChange={(e) => set({ from: e.target.value })}
          />
          <Input
            type="date"
            className={filterClasses.control}
            aria-label="집계 종료일"
            value={value.to}
            onChange={(e) => set({ to: e.target.value })}
          />
        </div>
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
