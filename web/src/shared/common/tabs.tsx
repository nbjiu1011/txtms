"use client";

import { Tabs, ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

/* ---------- SubTabs ---------- */

export interface SubTabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export interface SubTabsProps<K extends string> {
  items: SubTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}

/**
 * `.subtabs` — underlined section tabs (navy underline on the selected tab), on radix Tabs (arrow keys
 * move between tabs, Enter/Space selects). Only the tab list is rendered: the caller renders the
 * selected section itself, so the triggers carry no `aria-controls`.
 */
export function SubTabs<K extends string>({ items, value, onChange, label, className }: SubTabsProps<K>) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(next as K)} activationMode="manual">
      <Tabs.List
        aria-label={label}
        // Horizontal scroll only (overflow-x: auto alone turns overflow-y to auto as well). The 1px baseline is an
        // inset shadow and each tab ends 1px above it with a 1px underline — the reference look (navy line on the gray
        // baseline) without pulling the tabs into a border, which overflowed the list and showed a vertical scrollbar.
        className={cn(
          "mb-[18px] flex gap-[18px] overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--line)]",
          className,
        )}
      >
        {items.map((item) => (
          <Tabs.Trigger
            key={item.key}
            value={item.key}
            aria-controls={undefined}
            // radix selects on mousedown; a click alone (screen readers, scripted clicks) must select too
            onClick={() => {
              if (item.key !== value) onChange(item.key);
            }}
            className={cn(
              "mb-px flex cursor-pointer items-center gap-1.5 border-0 border-b border-transparent bg-transparent px-0 py-[9px]",
              "whitespace-nowrap text-sub",
              // the reference adds an empty ::after to the selected tab: one more flex gap (6px) of width
              "data-[state=active]:border-navy data-[state=active]:font-semibold data-[state=active]:text-ink",
              "data-[state=active]:after:content-['']",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="rounded-md bg-sunk px-1.5 text-[11px] font-medium text-sub">{item.count}</span>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

/* ---------- Seg ---------- */

export interface SegProps<K extends string> {
  options: { key: K; label: ReactNode }[];
  value: K | null;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}

/**
 * `.seg` — segmented single choice (selected = navy), on radix ToggleGroup (single): arrow keys move
 * between options. Clicking the selected option keeps it selected.
 */
export function Seg<K extends string>({ options, value, onChange, label, className }: SegProps<K>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onChange(next as K);
      }}
      aria-label={label}
      className={cn("inline-flex overflow-hidden rounded-md border border-line2", className)}
    >
      {options.map((opt) => (
        <ToggleGroup.Item
          key={opt.key}
          value={opt.key}
          className={cn(
            "cursor-pointer border-0 border-r border-line bg-surface px-3 py-1.5 text-[13px] text-sub last:border-r-0",
            "data-[state=on]:bg-navy data-[state=on]:text-(--on-navy)",
          )}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
