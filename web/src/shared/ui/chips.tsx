import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { TypeGlyph, type TypeGlyphName } from "./icons/icons";
import styles from "./chips.module.css";

/** Request status tones (`--s-*`). */
export type StatusTone = "draft" | "wait" | "review" | "ask" | "appr" | "done";

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Visible label — status is never conveyed by color alone. */
  children: ReactNode;
}

/** `.st` — pill with a dot, tinted with the status tone. */
export function StatusChip({ tone, className, children, ...rest }: StatusChipProps) {
  return (
    <span className={cn(styles.st, styles[tone], className)} {...rest}>
      {children}
    </span>
  );
}

/** Content type tones (`--ty-*`): a 알림톡 · s 문자 · r RCS · f 자유입력형. */
export type TypeTone = TypeGlyphName;

export interface TypeChipProps {
  tone: TypeTone;
  /** Type name; shown as text when `showLabel`, otherwise exposed as the accessible name. */
  label: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** `.tychip` — tinted glyph tile (+ optional label). */
export function TypeChip({ tone, label, showLabel = false, size = "md", className }: TypeChipProps) {
  return (
    <span
      className={cn(styles.tychip, styles[`ty-${tone}`], size !== "md" && styles[size], className)}
      title={label}
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
    >
      <TypeGlyph glyph={tone} />
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}

/** `.round` — review round badge (navy + brand text), e.g. "2차". */
export function RoundBadge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(styles.round, className)} {...rest} />;
}
