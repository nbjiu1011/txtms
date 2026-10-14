"use client";

import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/shared/lib";
import {
  RANGE_PRESETS,
  WEEKDAYS,
  addDays,
  addMonths,
  compareDay,
  dayLabel,
  formatDay,
  monthGrid,
  orderedRange,
  parseDay,
  rangeLabel,
  sameDay,
  today,
  withinRange,
  type Day,
  type DayRange,
} from "./calendar";
import { CONTROL_CLASS } from "./control";

const TRIGGER_CLASS = cn(
  CONTROL_CLASS,
  "flex cursor-pointer items-center justify-between gap-2 whitespace-nowrap tabular-nums",
  "data-[empty=true]:text-faint",
);

const POPOVER_CLASS = "z-70 rounded-lg border border-line bg-surface p-3 shadow-pop outline-none";

/* ---------- single date ---------- */

export interface DatePickerProps {
  id?: string;
  /** `YYYY-MM-DD` or "" */
  value: string;
  onChange: (value: string) => void;
  /** Earliest / latest selectable day (`YYYY-MM-DD`). */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shows the value but cannot be opened (read-only forms). */
  readOnly?: boolean;
  /** Required fields offer no 지우기. */
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Date field with a calendar (radix Popover): the field shows `2026-10-14 (화)`, a click opens the month grid,
 * arrow keys move by day/week and PageUp/PageDown by month, Enter picks. Days outside `min`–`max` cannot be picked.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "날짜 선택",
  disabled,
  readOnly,
  required,
  className,
  ref,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  const minDay = parseDay(min);
  const maxDay = parseDay(max);
  const locked = disabled || readOnly;

  return (
    <Popover.Root open={open && !locked} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        aria-readonly={readOnly || undefined}
        aria-haspopup="dialog"
        data-value={value}
        data-empty={!value || undefined}
        className={cn(TRIGGER_CLASS, readOnly && "cursor-default bg-sunk text-sub", className)}
        {...aria}
      >
        <span>{value ? dayLabel(value) : placeholder}</span>
        <CalendarIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} aria-label="날짜 선택" className={POPOVER_CLASS}>
          <MonthView
            initial={selected ?? clamp(today(), minDay, maxDay)}
            min={minDay}
            max={maxDay}
            isSelected={(d) => sameDay(d, selected)}
            onPick={(d) => {
              onChange(formatDay(d));
              setOpen(false);
            }}
          />
          <div className="mt-2 flex justify-between gap-2 border-t border-line pt-2">
            {required ? (
              <span />
            ) : (
              <TextAction
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                지우기
              </TextAction>
            )}
            {withinRange(today(), minDay, maxDay) ? (
              <TextAction
                onClick={() => {
                  onChange(formatDay(today()));
                  setOpen(false);
                }}
              >
                오늘
              </TextAction>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------- range ---------- */

export interface DateRangePickerProps {
  id?: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Period field: one field, one calendar. The first pick is the start, the second the end (in either order);
 * quick picks (오늘 · 이번 주 · 이번 달 · 최근 7일 · 최근 30일) and 전체 기간 (clear) sit beside the calendar.
 */
export function DateRangePicker({
  id,
  from,
  to,
  onChange,
  placeholder = "전체 기간",
  className,
  ...aria
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Day | null>(null);
  const [hover, setHover] = useState<Day | null>(null);
  const start = parseDay(from);
  const end = parseDay(to);
  const label = rangeLabel({ from, to });

  const finish = (range: DayRange) => {
    onChange(range.from, range.to);
    setOpen(false);
  };

  // while choosing, the range under the pointer is previewed from the first pick
  const preview = anchor ? orderedRange(anchor, hover ?? anchor) : null;
  const lo = preview ? parseDay(preview.from) : start;
  const hi = preview ? parseDay(preview.to) : end;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setAnchor(null);
        setHover(null);
      }}
    >
      <Popover.Trigger
        id={id}
        type="button"
        aria-haspopup="dialog"
        data-from={from}
        data-to={to}
        data-empty={!label || undefined}
        className={cn(TRIGGER_CLASS, "min-w-[220px]", className)}
        {...aria}
      >
        <span>{label || placeholder}</span>
        <CalendarIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} aria-label="기간 선택" className={POPOVER_CLASS}>
          <div className="flex gap-3">
            <div className="flex w-[92px] flex-col gap-0.5 border-r border-line pr-3" role="group" aria-label="빠른 선택">
              {RANGE_PRESETS.map((p) => {
                const r = p.range();
                const on = r.from === from && r.to === to;
                return (
                  <PresetButton key={p.key} on={on} onClick={() => finish(r)}>
                    {p.label}
                  </PresetButton>
                );
              })}
              <PresetButton on={!from && !to} onClick={() => finish({ from: "", to: "" })}>
                전체 기간
              </PresetButton>
            </div>
            <div>
              <p className="mb-1 text-[12px] text-sub" aria-live="polite">
                {anchor ? "종료일을 고르세요" : "시작일을 고르세요"}
              </p>
              <MonthView
                initial={start ?? today()}
                min={null}
                max={null}
                isSelected={(d) => sameDay(d, lo) || sameDay(d, hi)}
                inRange={(d) => !!lo && !!hi && compareDay(d, lo) > 0 && compareDay(d, hi) < 0}
                onHover={setHover}
                onPick={(d) => {
                  if (!anchor) {
                    setAnchor(d);
                    setHover(d);
                    return;
                  }
                  finish(orderedRange(anchor, d));
                  setAnchor(null);
                }}
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------- month grid ---------- */

interface MonthViewProps {
  initial: Day;
  min: Day | null;
  max: Day | null;
  isSelected: (d: Day) => boolean;
  inRange?: (d: Day) => boolean;
  onHover?: (d: Day) => void;
  onPick: (d: Day) => void;
}

/** One month as a 6 × 7 grid with roving focus (a single day is in the tab order). */
function MonthView({ initial, min, max, isSelected, inRange, onHover, onPick }: MonthViewProps) {
  const [cursor, setCursor] = useState<Day>(initial);
  const gridRef = useRef<HTMLDivElement>(null);
  const now = today();
  const cells = monthGrid(cursor.year, cursor.month);

  // keyboard moves follow focus, so a screen reader reads the day the cursor is on
  const focusCursor = useRef(false);
  useEffect(() => {
    if (!focusCursor.current) return;
    focusCursor.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-cursor="true"]')?.focus();
  }, [cursor]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Day | null = null;
    if (event.key in step) next = addDays(cursor, step[event.key]);
    else if (event.key === "PageUp") next = addMonths(cursor, -1);
    else if (event.key === "PageDown") next = addMonths(cursor, 1);
    if (!next) return;
    event.preventDefault();
    focusCursor.current = true;
    setCursor(next);
  };

  return (
    <div className="w-[252px]">
      <div className="mb-1 flex items-center justify-between">
        <NavButton label="이전 달" onClick={() => setCursor(addMonths(cursor, -1))}>
          <path d="M15 6l-6 6 6 6" />
        </NavButton>
        <span className="text-[14px] font-semibold" aria-live="polite">
          {cursor.year}년 {cursor.month}월
        </span>
        <NavButton label="다음 달" onClick={() => setCursor(addMonths(cursor, 1))}>
          <path d="M9 6l6 6-6 6" />
        </NavButton>
      </div>
      <div className="grid grid-cols-7" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={cn(
              "flex h-7 items-center justify-center text-[11px]",
              i === 0 ? "text-danger" : i === 6 ? "text-s-review" : "text-faint",
            )}
          >
            {w}
          </span>
        ))}
      </div>
      <div ref={gridRef} role="grid" aria-label={`${cursor.year}년 ${cursor.month}월`} className="grid grid-cols-7 gap-y-0.5" onKeyDown={move}>
        {cells.map((cell) => {
          const allowed = withinRange(cell, min, max);
          const selected = isSelected(cell);
          const between = inRange?.(cell) ?? false;
          const isToday = sameDay(cell, now);
          const isCursor = sameDay(cell, cursor);
          return (
            <button
              key={formatDay(cell)}
              type="button"
              role="gridcell"
              data-day={formatDay(cell)}
              data-cursor={isCursor || undefined}
              tabIndex={isCursor ? 0 : -1}
              disabled={!allowed}
              aria-selected={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={dayLabel(formatDay(cell))}
              onClick={() => onPick(cell)}
              onMouseEnter={() => onHover?.(cell)}
              onFocus={() => onHover?.(cell)}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[13px] tabular-nums",
                cell.inMonth ? "text-ink" : "text-faint",
                between && "rounded-none bg-indigo-soft",
                selected ? "bg-navy font-semibold text-(--on-navy)" : "hover:bg-sunk",
                isToday && !selected && "font-semibold text-s-review underline underline-offset-4",
                !allowed && "cursor-not-allowed opacity-35 hover:bg-transparent",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clamp(d: Day, min: Day | null, max: Day | null): Day {
  if (min && compareDay(d, min) < 0) return min;
  if (max && compareDay(d, max) > 0) return max;
  return d;
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-sub hover:bg-sunk hover:text-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

function TextAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-[12px] text-sub hover:bg-sunk hover:text-ink"
    >
      {children}
    </button>
  );
}

function PresetButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-sub hover:bg-sunk hover:text-ink",
        on && "bg-indigo-soft font-semibold text-ink",
      )}
    >
      {children}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-sub">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
