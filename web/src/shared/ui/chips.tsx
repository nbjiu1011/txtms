import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { TypeGlyph, type TypeGlyphName } from "./icons/icons";

/** Request status tones (`--s-*`). */
export type StatusTone = "draft" | "wait" | "review" | "ask" | "appr" | "done";

/** Sets the chip color `--c` from the status tone. */
const STATUS_TONE: Record<StatusTone, string> = {
  draft: "[--c:var(--s-draft)]",
  wait: "[--c:var(--s-wait)]",
  review: "[--c:var(--s-review)]",
  ask: "[--c:var(--s-ask)]",
  appr: "[--c:var(--s-appr)]",
  done: "[--c:var(--s-done)]",
};

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  /** Visible label — status is never conveyed by color alone. */
  children: ReactNode;
}

/** `.st` — pill with a dot, tinted with the status tone. */
export function StatusChip({ tone, className, children, ...rest }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-semibold py-0.5 pr-[9px] pl-2 rounded-pill whitespace-nowrap",
        "text-(--c) bg-[color-mix(in_srgb,var(--c)_11%,transparent)]",
        "before:content-[''] before:size-[7px] before:rounded-[50%] before:bg-(--c)",
        STATUS_TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/** Content type tones (`--ty-*`): a 알림톡 · s 문자 · r RCS · f 자유입력형. */
export type TypeTone = TypeGlyphName;

const TYPE_TONE: Record<TypeTone, string> = {
  a: "[--c:var(--ty-a)]",
  s: "[--c:var(--ty-s)]",
  r: "[--c:var(--ty-r)]",
  f: "[--c:var(--ty-f)]",
};

/** Glyph tile size per chip size. */
const TYPE_GLYPH_SIZE: Record<NonNullable<TypeChipProps["size"]>, string> = {
  sm: "[&_svg]:size-[22px] [&_svg]:p-1 [&_svg]:rounded-btn",
  md: "[&_svg]:size-[26px] [&_svg]:p-[5px] [&_svg]:rounded-btn",
  lg: "[&_svg]:size-[34px] [&_svg]:p-[7px] [&_svg]:rounded-(--r-9)",
};

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
      className={cn(
        "inline-flex items-center gap-1.5 text-(--c) text-[12px] font-medium flex-none",
        "[&_svg]:bg-[color-mix(in_srgb,var(--c)_12%,var(--surface))] [&_svg]:flex-none [&>span]:text-ink",
        TYPE_GLYPH_SIZE[size],
        TYPE_TONE[tone],
        className,
      )}
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
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 font-bold text-[13px] border-0 bg-navy text-brand rounded-(--r-6) py-0 px-[7px] leading-[22px]",
        className,
      )}
      {...rest}
    />
  );
}
