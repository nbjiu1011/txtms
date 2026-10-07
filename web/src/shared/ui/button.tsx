import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/shared/lib";
import styles from "./button.module.css";

export type ButtonVariant = "default" | "pri" | "ok" | "warn" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  ref?: Ref<HTMLButtonElement>;
}

/** `.btn` — h34 (sm h28), radius 7. Variants: pri (navy), ok (done), warn (danger text), ghost. */
export function Button({ variant = "default", size = "md", className, type = "button", ref, ...rest }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(styles.btn, variant !== "default" && styles[variant], size === "sm" && styles.sm, className)}
      {...rest}
    />
  );
}

/** Class names for non-button elements that must look like a button (e.g. a file `<label>`). */
export function buttonClassName(variant: ButtonVariant = "default", size: "md" | "sm" = "md"): string {
  return cn(styles.btn, variant !== "default" && styles[variant], size === "sm" && styles.sm);
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (required: the button has no visible text). */
  label: string;
  children: ReactNode;
  /** Numeric badge (e.g. unread count). Hidden when 0 or undefined. */
  badge?: number;
  ref?: Ref<HTMLButtonElement>;
}

/** `.iconbtn` — 34×34 ghost icon button with optional count badge. */
export function IconButton({ label, children, badge, className, type = "button", ref, ...rest }: IconButtonProps) {
  return (
    <button ref={ref} type={type} aria-label={label} className={cn(styles.iconbtn, className)} {...rest}>
      {children}
      {badge ? (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
