import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";
import styles from "./tag.module.css";

export type TagVariant = "default" | "hot" | "flag" | "recall" | "fill";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** hot: overdue/urgent · flag: dashed policy note · recall: recall requested · fill: neutral filled. */
  variant?: TagVariant;
}

export function Tag({ variant = "default", className, ...rest }: TagProps) {
  return <span className={cn(styles.tag, variant !== "default" && styles[variant], className)} {...rest} />;
}
