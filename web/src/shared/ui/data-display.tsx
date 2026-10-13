import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { cn } from "@/shared/lib";
import { EmptyArt } from "./icons/icons";
import type { StatusTone } from "./chips";

/* ---------- Table ---------- */

/** Cell/row modifiers of the `.tbl` table: `id` (sub, nowrap), `ttl` (500), `click` (row hover). */
export const tableClasses = {
  id: "text-sub whitespace-nowrap",
  ttl: "font-medium",
  click: "cursor-pointer [&:hover>td]:bg-indigo-soft",
} as const;

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  wrapClassName?: string;
}

/** `.tbl-wrap > table.tbl` — horizontally scrollable data table. */
export function Table({ className, wrapClassName, ...rest }: TableProps) {
  return (
    <div className={cn("overflow-x-auto", wrapClassName)}>
      <table
        className={cn(
          "w-full border-collapse text-[13px]",
          "[&_th]:text-left [&_th]:font-medium [&_th]:text-faint [&_th]:py-[9px] [&_th]:px-3 [&_th]:border-b [&_th]:border-line",
          "[&_th]:whitespace-nowrap [&_th]:bg-transparent [&_th]:sticky [&_th]:top-0",
          "[&_td]:py-2.5 [&_td]:px-3 [&_td]:border-b [&_td]:border-line [&_td]:align-middle",
          "[&_tr:last-child_td]:border-b-0",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

/* ---------- KPI ---------- */

export function KpiGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 rounded-lg mb-[22px]", className)}
      {...rest}
    />
  );
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

/** `.kpi` tile: left accent stripe in `--c` (unset = no stripe). Static tiles keep the hover tint. */
const KPI_BASE = cn(
  "block w-full relative overflow-hidden py-4 px-[18px] bg-surface text-left border-0 rounded-lg shadow-lift hover:bg-sunk",
  "before:content-[''] before:absolute before:left-0 before:top-3.5 before:bottom-3.5 before:w-[3px]",
  "before:rounded-[0_var(--r-3)_var(--r-3)_0] before:bg-(--c)",
);

/** `.kpi` — metric tile with a left accent and optional bar. */
export function Kpi({ tone, label, value, unit, barPercent, interactive = true, className, ...rest }: KpiProps) {
  const style = {
    ...(tone ? { "--c": KPI_TONE[tone] } : {}),
    ...(barPercent !== undefined ? { "--pct": `${Math.max(0, Math.min(100, barPercent))}%` } : {}),
  } as CSSProperties;
  const body = (
    <>
      <div className="text-[13px] text-sub flex items-center gap-1.5">{label}</div>
      <div
        className={cn(
          "text-[30px] font-semibold tracking-[-0.03em] leading-[1.2] mt-1.5",
          "[&_small]:text-[13px] [&_small]:font-normal [&_small]:text-faint [&_small]:ml-1",
        )}
      >
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {barPercent !== undefined ? (
        <span
          className={cn(
            "block h-1 rounded-(--r-2) bg-sunk mt-2.5 overflow-hidden",
            "[&>i]:block [&>i]:h-full [&>i]:bg-(--c) [&>i]:rounded-(--r-2) [&>i]:w-(--pct)",
          )}
          aria-hidden="true"
        >
          <i />
        </span>
      ) : null}
    </>
  );
  if (!interactive) {
    return (
      <div className={cn(KPI_BASE, "cursor-default", className)} style={style}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={cn(KPI_BASE, "cursor-pointer", className)} style={style} {...rest}>
      {body}
    </button>
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
   * The trailing content holds its own buttons: the row is then a clickable `div` whose leading + title
   * part is the `role=button` (a button cannot contain buttons). Clicks on those buttons should stop
   * propagation.
   */
  nestedActions?: boolean;
  /** Extra content under the meta line inside the main column (e.g. an expanded notice body). */
  extra?: ReactNode;
  /** Accordion rows: whether `extra` is shown (`aria-expanded`). */
  expanded?: boolean;
  className?: string;
}

/** `.list-item` row; clickable rows get the pointer + hover tint. */
const LIST_ITEM = cn(
  "flex items-center gap-3 py-[11px] px-[18px] w-full bg-transparent text-left",
  "border-0 border-b border-line last:border-b-0",
);
const LIST_ITEM_CLICK = "cursor-pointer hover:bg-sunk";

/** Title/meta column (`.main`). */
const LIST_MAIN = cn(
  "min-w-0 flex-1",
  "[&>b]:font-medium [&>b]:block [&>b]:overflow-hidden [&>b]:text-ellipsis [&>b]:whitespace-nowrap",
  "[&>span]:text-[12px] [&>span]:text-faint",
);

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
      <span className={LIST_MAIN}>
        <b>{title}</b>
        {meta ? <span>{meta}</span> : null}
        {extra}
      </span>
      {trailing}
    </>
  );
  if (onClick && nestedActions) {
    // The whole row is clickable, but only the leading visual + title part is the button: the trailing
    // buttons must not be nested inside another interactive element.
    return (
      <div className={cn(LIST_ITEM, LIST_ITEM_CLICK, className)} onClick={onClick}>
        <span
          role="button"
          tabIndex={0}
          className="flex items-center gap-3 flex-1 min-w-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
        >
          {leading}
          <span className={LIST_MAIN}>
            <b>{title}</b>
            {meta ? <span>{meta}</span> : null}
            {extra}
          </span>
        </span>
        {trailing}
      </div>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(LIST_ITEM, LIST_ITEM_CLICK, className)}
        onClick={onClick}
        aria-expanded={expanded}
      >
        {content}
      </button>
    );
  }
  return <div className={cn(LIST_ITEM, "cursor-default", className)}>{content}</div>;
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
    <div
      className={cn(
        "py-9 px-5 text-center text-sub [&>b]:block [&>b]:text-ink [&>b]:font-semibold [&>b]:mb-1",
        className,
      )}
    >
      {plain ? null : <EmptyArt className="w-[120px] h-[72px] block mt-0 mx-auto mb-3" />}
      <b>{title}</b>
      {description}
      {action ? <div className="mt-3">{action}</div> : null}
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

/** Per-state classes of a step: connector line (`::before`), node (`.nd`) and label (`.nm`). */
const STEP_STATE: Record<TrackStep["state"], { line: string; node: string; name: string }> = {
  past: { line: "before:bg-navy", node: "bg-navy border-navy", name: "text-sub" },
  current: {
    line: "before:bg-line",
    node: "bg-(--c) border-(--c) shadow-[0_0_0_4px_color-mix(in_srgb,var(--c)_20%,transparent)]",
    name: "text-ink font-semibold",
  },
  future: { line: "before:bg-line", node: "bg-surface border-line2", name: "text-faint" },
};

/** `.track` — request lifecycle steps with past/current states. */
export function ProgressTrack({ steps, label, className }: ProgressTrackProps) {
  return (
    <div
      className={cn("flex items-stretch mt-1 mb-[18px] overflow-x-auto pb-0.5", className)}
      role="list"
      aria-label={label}
    >
      {steps.map((step) => {
        const state = STEP_STATE[step.state];
        return (
          <div
            key={step.key}
            role="listitem"
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "flex-1 min-w-[104px] relative pt-[18px]",
              "before:content-[''] before:absolute before:top-1.5 before:left-0 before:right-0 before:h-[3px] before:rounded-(--r-2)",
              state.line,
            )}
            style={step.color ? ({ "--c": step.color } as CSSProperties) : undefined}
          >
            <span className={cn("absolute top-0 left-0 size-[15px] rounded-[50%] border-2", state.node)} />
            <span className={cn("text-[13px] block pr-2", state.name)}>{step.label}</span>
            {step.loop ? <span className="text-[11px] text-s-ask block">{step.loop}</span> : null}
            <span className="text-[11px] text-faint">{step.date}</span>
          </div>
        );
      })}
    </div>
  );
}
