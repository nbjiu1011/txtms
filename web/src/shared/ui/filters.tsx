import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Input } from "./form";
import styles from "./filters.module.css";

/** Class names of controls inside a `FilterBar` (compact inputs, reset button offset). */
export const filterClasses = {
  /** Input / select inside a filter field (min-height 32, auto width). */
  control: styles.ctl,
  /** Ghost `초기화` button aligned with the controls' baseline. */
  reset: styles.reset,
  /** Checkbox label aligned with the controls. */
  check: styles.check,
};

export interface FilterBarProps {
  /** Accessible name of the search region. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** `.filters` — raised bar of labelled filter controls above a list. */
export function FilterBar({ label, children, className }: FilterBarProps) {
  return (
    <div className={cn(styles.filters, className)} role="search" aria-label={label}>
      {children}
    </div>
  );
}

export interface FilterFieldProps {
  label: string;
  /** Id of the control the label names. */
  htmlFor?: string;
  /** Takes the remaining width (search text; min width 200px, or `minWidth`). */
  grow?: boolean;
  children: ReactNode;
  className?: string;
}

/** `.filters .f` — label above one control. */
export function FilterField({ label, htmlFor, grow, children, className }: FilterFieldProps) {
  return (
    <div className={cn(styles.f, grow && styles.grow, className)}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export interface DateRangeFilterProps {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

/** Two date inputs `시작 ~ 끝` under one label. */
export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className={styles.f} role="group" aria-label={label}>
      <label>{label}</label>
      <div className={styles.range}>
        <Input
          type="date"
          className={styles.ctl}
          aria-label={`${label} 시작`}
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
        />
        <span className={styles.tilde}>~</span>
        <Input
          type="date"
          className={styles.ctl}
          aria-label={`${label} 끝`}
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </div>
    </div>
  );
}
