import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";

export type TagVariant = "default" | "hot" | "flag" | "recall" | "fill";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** hot: overdue/urgent · flag: dashed policy note · recall: recall requested · fill: neutral filled. */
  variant?: TagVariant;
}

const TAG_BASE =
  "inline-flex items-center gap-1 text-[12px] py-px px-[7px] rounded-(--r-xs) border whitespace-nowrap";

/** Border/text/background per variant (each sets all three so nothing has to be overridden). */
const TAG_VARIANT: Record<TagVariant, string> = {
  default: "border-line text-sub bg-surface",
  hot: "border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] text-danger bg-surface",
  flag: "border-dashed border-s-wait text-s-wait bg-surface",
  recall: "border-transparent text-danger bg-danger-soft font-medium",
  fill: "border-transparent text-sub bg-sunk",
};

export function Tag({ variant = "default", className, ...rest }: TagProps) {
  return <span className={cn(TAG_BASE, TAG_VARIANT[variant], className)} {...rest} />;
}
