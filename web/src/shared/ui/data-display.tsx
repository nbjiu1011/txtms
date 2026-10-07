import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/shared/lib";
import { EmptyArt } from "./icons/icons";
import type { StatusTone } from "./chips";
import styles from "./data-display.module.css";

/* ---------- Table ---------- */

/** Cell/row modifiers of the `.tbl` table: `id` (sub, nowrap), `ttl` (500), `click` (row hover). */
export const tableClasses = {
  id: styles.id,
  ttl: styles.ttl,
  click: styles.click,
} as const;

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  wrapClassName?: string;
}

/** `.tbl-wrap > table.tbl` — horizontally scrollable data table. */
export function Table({ className, wrapClassName, ...rest }: TableProps) {
  return (
    <div className={cn(styles.wrap, wrapClassName)}>
      <table className={cn(styles.tbl, className)} {...rest} />
    </div>
  );
}

/* ---------- KPI ---------- */

export function KpiGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.kpis, className)} {...rest} />;
}

export interface KpiProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Accent color token, e.g. `var(--s-review)` or a status tone. Omit for no accent stripe. */
  tone?: StatusTone | "danger";
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** Optional 0–100 mini bar under the value. */
  barPercent?: number;
  /** Render as a non-interactive tile. */
  interactive?: boolean;
}

const KPI_TONE: Record<NonNullable<KpiProps["tone"]>, string> = {
  draft: "var(--s-draft)",
  wait: "var(--s-wait)",
  review: "var(--s-review)",
  ask: "var(--s-ask)",
  appr: "var(--s-appr)",
  done: "var(--s-done)",
  danger: "var(--danger)",
};

/** `.kpi` — metric tile with a left accent and optional bar. */
export function Kpi({ tone, label, value, unit, barPercent, interactive = true, className, ...rest }: KpiProps) {
  const style = {
    ...(tone ? { "--c": KPI_TONE[tone] } : {}),
    ...(barPercent !== undefined ? { "--pct": `${Math.max(0, Math.min(100, barPercent))}%` } : {}),
  } as CSSProperties;
  const body = (
    <>
      <div className={styles.kpiK}>{label}</div>
      <div className={styles.kpiV}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {barPercent !== undefined ? (
        <span className={styles.kbar} aria-hidden="true">
          <i />
        </span>
      ) : null}
    </>
  );
  if (!interactive) {
    return (
      <div className={cn(styles.kpi, styles.static, className)} style={style}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={cn(styles.kpi, className)} style={style} {...rest}>
      {body}
    </button>
  );
}

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

/** `.subtabs` — underlined section tabs (navy underline on the selected tab). */
export function SubTabs<K extends string>({ items, value, onChange, label, className }: SubTabsProps<K>) {
  return (
    <div className={cn(styles.subtabs, className)} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          className={item.key === value ? styles.on : undefined}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined ? <span className={styles.n}>{item.count}</span> : null}
        </button>
      ))}
    </div>
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

/** `.seg` — segmented single choice (selected = navy). */
export function Seg<K extends string>({ options, value, onChange, label, className }: SegProps<K>) {
  return (
    <div className={cn(styles.seg, className)} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-pressed={opt.key === value}
          className={opt.key === value ? styles.on : undefined}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- ListItem ---------- */

export interface ListItemProps {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  /**
   * The trailing content holds its own buttons: the clickable row is then a `div[role=button]`
   * (a button cannot contain buttons). Clicks on those buttons should stop propagation.
   */
  nestedActions?: boolean;
  /** Extra content under the meta line inside the main column (e.g. an expanded notice body). */
  extra?: ReactNode;
  /** Accordion rows: whether `extra` is shown (`aria-expanded`). */
  expanded?: boolean;
  className?: string;
}

/** `.list-item` — row with leading visual, title/meta and trailing content. A button when clickable. */
export function ListItem({
  leading,
  title,
  meta,
  trailing,
  onClick,
  nestedActions,
  extra,
  expanded,
  className,
}: ListItemProps) {
  const content = (
    <>
      {leading}
      <span className={styles.main}>
        <b>{title}</b>
        {meta ? <span>{meta}</span> : null}
        {extra}
      </span>
      {trailing}
    </>
  );
  if (onClick && nestedActions) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(styles.listItem, className)}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {content}
      </div>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cn(styles.listItem, className)} onClick={onClick} aria-expanded={expanded}>
        {content}
      </button>
    );
  }
  return <div className={cn(styles.listItem, styles.static, className)}>{content}</div>;
}

/* ---------- Empty ---------- */

export interface EmptyProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Hide the illustration (compact empty states such as popovers). */
  plain?: boolean;
  className?: string;
}

/** `.empty` — illustration + title + description + optional action. */
export function Empty({ title, description, action, plain, className }: EmptyProps) {
  return (
    <div className={cn(styles.empty, className)}>
      {plain ? null : <EmptyArt className={styles.emptyArt} />}
      <b>{title}</b>
      {description}
      {action ? <div className={styles.emptyAct}>{action}</div> : null}
    </div>
  );
}

/* ---------- ProgressTrack ---------- */

export interface TrackStep {
  key: string;
  label: ReactNode;
  state: "past" | "current" | "future";
  /** Node color of the current step, e.g. `var(--s-review)`. */
  color?: string;
  /** Loop note under the label (e.g. "확인 요청 2회"). */
  loop?: ReactNode;
  /** Reached time text. */
  date?: ReactNode;
}

export interface ProgressTrackProps {
  steps: TrackStep[];
  label: string;
  className?: string;
}

/** `.track` — request lifecycle steps with past/current states. */
export function ProgressTrack({ steps, label, className }: ProgressTrackProps) {
  return (
    <div className={cn(styles.track, className)} role="list" aria-label={label}>
      {steps.map((step) => (
        <div
          key={step.key}
          role="listitem"
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn(styles.stp, step.state === "past" && styles.past, step.state === "current" && styles.cur)}
          style={step.color ? ({ "--c": step.color } as CSSProperties) : undefined}
        >
          <span className={styles.nd} />
          <span className={styles.nm}>{step.label}</span>
          {step.loop ? <span className={styles.loop}>{step.loop}</span> : null}
          <span className={styles.ds}>{step.date}</span>
        </div>
      ))}
    </div>
  );
}
