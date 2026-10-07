import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import styles from "./surfaces.module.css";

export type BannerTone = "ask" | "info" | "danger" | "done" | "appr" | "wait";

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
    <div className={cn(styles.banner, tone !== "ask" && styles[tone], className)} {...rest}>
      <div className={styles.bt}>
        {title ? <b>{title}</b> : null}
        {children}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn(styles.panel, className)} {...rest} />;
}

export interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  note?: ReactNode;
}

/** `.panel-h` — title (h3 15/600), optional note, then any trailing children (actions). */
export function PanelHeader({ title, note, children, className, ...rest }: PanelHeaderProps) {
  return (
    <div className={cn(styles.panelH, className)} {...rest}>
      <h3>{title}</h3>
      {note ? <span className={styles.note}>{note}</span> : null}
      {children}
    </div>
  );
}

export function PanelBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.panelB, className)} {...rest} />;
}

export interface LockBarProps extends HTMLAttributes<HTMLDivElement> {
  /** neutral: read-only reason (sunk background) instead of the lock highlight. */
  neutral?: boolean;
}

/** `.lockbar` — edit-lock / read-only notice above an editor. */
export function LockBar({ neutral, className, ...rest }: LockBarProps) {
  return <div role="status" className={cn(styles.lockbar, neutral && styles.neutral, className)} {...rest} />;
}

export function ReadOnlyBox({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.roBox, className)} {...rest} />;
}

export interface KeyValueListProps {
  items: { label: ReactNode; value: ReactNode }[];
  className?: string;
}

/** `.kv` — 140px label column definition list (1 column ≤860px). */
export function KeyValueList({ items, className }: KeyValueListProps) {
  return (
    <dl className={cn(styles.kv, className)}>
      {items.map((item, i) => (
        <div key={i} className={styles.kvRow}>
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
      className={cn(styles.bar, className)}
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

export interface SaveIndicatorProps {
  state: SaveState;
  children: ReactNode;
}

/** `.save-ind` — autosave status text. */
export function SaveIndicator({ state, children }: SaveIndicatorProps) {
  return (
    <span role="status" className={cn(styles.saveInd, state !== "idle" && styles[state])}>
      {children}
    </span>
  );
}
