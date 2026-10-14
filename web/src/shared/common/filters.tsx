import type { ReactNode } from "react";
import { cn } from "@/shared/lib";
import { DateRangePicker } from "./date-picker";

/** Class names of controls inside a `FilterBar` (compact inputs, reset button offset). */
export const filterClasses = {
  /** Input / select inside a filter field (min-height 32, auto width). */
  control: "min-h-8 w-auto px-2 py-[5px]",
  /** Ghost `초기화` button aligned with the controls' baseline. */
  reset: "mb-[3px]",
  /** Checkbox label aligned with the controls. */
  check: "mb-[7px]",
  /** Row of controls under one label (e.g. two dates without a separator). */
  range: "flex items-center gap-2",
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
    <div
      className={cn(
        "mb-4 flex flex-wrap items-end gap-2 rounded-md border border-transparent bg-surface p-3.5 shadow-lift",
        className,
      )}
      role="search"
      aria-label={label}
    >
      {children}
    </div>
  );
}

const FIELD = "flex flex-col gap-1 [&>label]:text-[12px] [&>label]:text-sub";

export interface FilterFieldProps {
  label: string;
  /** Id of the control the label names. */
  htmlFor?: string;
  /** Takes the remaining width (search text; min width 200px, or `minWidth`). */
  grow?: boolean;
  children: ReactNode;
  className?: string;
}

/** `.filters .f` — label above one control. A growing field stretches its control to the full width. */
export function FilterField({ label, htmlFor, grow, children, className }: FilterFieldProps) {
  return (
    <div
      className={cn(
        FIELD,
        grow && "min-w-[200px] flex-1 [&_[role=combobox]]:w-full [&_input]:w-full",
        className,
      )}
    >
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

/** A period under one label: one field with a calendar and quick picks ({@link DateRangePicker}). */
export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className={FIELD}>
      <label>{label}</label>
      <DateRangePicker aria-label={label} className={filterClasses.control} from={from} to={to} onChange={onChange} />
    </div>
  );
}
