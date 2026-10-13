import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";

export type BannerTone = "ask" | "info" | "danger" | "done" | "appr" | "wait";

/** Sets the banner color `--c` from the tone. */
const BANNER_TONE: Record<BannerTone, string> = {
  ask: "[--c:var(--s-ask)]",
  info: "[--c:var(--s-review)]",
  danger: "[--c:var(--danger)]",
  done: "[--c:var(--s-done)]",
  appr: "[--c:var(--s-appr)]",
  wait: "[--c:var(--s-wait)]",
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** ask (default, 확인 요청) · info (검수 중) · danger · done · appr · wait */
  tone?: BannerTone;
  title?: ReactNode;
  /** Trailing actions (buttons). */
  actions?: ReactNode;
}

/** `.banner` — tinted notice with a 4px left rule. */
export function Banner({ tone = "ask", title, actions, children, className, ...rest }: BannerProps) {
  return (
    <div
      className={cn(
        "flex gap-3 items-start py-3 px-4 rounded-banner mb-4",
        "border border-l-4 border-[color-mix(in_srgb,var(--c)_35%,var(--line))] bg-[color-mix(in_srgb,var(--c)_7%,var(--surface))]",
        BANNER_TONE[tone],
        className,
      )}
      {...rest}
    >
      <div className="flex-1 text-[13px] [&>b]:block [&>b]:text-[14px] [&>b]:mb-0.5">
        {title ? <b>{title}</b> : null}
        {children}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("border border-transparent rounded-lg bg-surface shadow-lift", className)}
      {...rest}
    />
  );
}

export interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  note?: ReactNode;
}

/** `.panel-h` — title (h3 15/600), optional note, then any trailing children (actions). */
export function PanelHeader({ title, note, children, className, ...rest }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-3.5 px-[18px] border-b border-line",
        "[&_h3]:m-0 [&_h3]:text-[15px] [&_h3]:font-semibold",
        className,
      )}
      {...rest}
    >
      <h3>{title}</h3>
      {note ? <span className="text-[12px] text-faint">{note}</span> : null}
      {children}
    </div>
  );
}

export function PanelBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-4 px-[18px]", className)} {...rest} />;
}

export interface LockBarProps extends HTMLAttributes<HTMLDivElement> {
  /** neutral: read-only reason (sunk background) instead of the lock highlight. */
  neutral?: boolean;
}

/** `.lockbar` — edit-lock / read-only notice above an editor. */
export function LockBar({ neutral, className, ...rest }: LockBarProps) {
  return (
    <div
      role="status"
      className={cn("text-[12px] py-2 px-3 rounded-sm mb-3", neutral ? "bg-sunk" : "bg-mark-soft", className)}
      {...rest}
    />
  );
}

export function ReadOnlyBox({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-3 px-3.5 border border-line rounded-md bg-sunk", className)} {...rest} />;
}

export interface KeyValueListProps {
  items: { label: ReactNode; value: ReactNode }[];
  className?: string;
}

/** `.kv` — 140px label column definition list (1 column ≤860px). */
export function KeyValueList({ items, className }: KeyValueListProps) {
  return (
    <dl
      className={cn(
        // the reference keeps the browser's default dl margin (1em 0)
        "grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-[13px] mx-0 my-[1em] upto-nav:grid-cols-[1fr]",
        "[&_dt]:text-sub [&_dd]:m-0",
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface BarProps {
  /** 0–100 */
  percent: number;
  label: string;
  className?: string;
}

/** `.bar` — thin navy progress bar. */
export function Bar({ percent, label, className }: BarProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn(
        "h-2 rounded-(--r-xs) bg-sunk overflow-hidden min-w-15",
        "[&>i]:block [&>i]:h-full [&>i]:bg-navy [&>i]:rounded-(--r-xs) [&>i]:w-(--pct)",
        className,
      )}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      style={{ "--pct": `${pct}%` } as CSSProperties}
    >
      <i />
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "fail";

const SAVE_STATE_COLOR: Record<SaveState, string> = {
  idle: "text-faint",
  saving: "text-s-review",
  saved: "text-s-done",
  fail: "text-danger",
};

export interface SaveIndicatorProps {
  state: SaveState;
  children: ReactNode;
}

/** `.save-ind` — autosave status text. */
export function SaveIndicator({ state, children }: SaveIndicatorProps) {
  return (
    <span role="status" className={cn("text-[12px] inline-flex items-center gap-1.5", SAVE_STATE_COLOR[state])}>
      {children}
    </span>
  );
}
