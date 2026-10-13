"use client";

import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "@/shared/lib";

export type ButtonVariant = "default" | "pri" | "ok" | "warn" | "ghost";

const BASE =
  "inline-flex items-center gap-1.5 h-[34px] px-3.5 py-0 rounded-btn border border-line2 bg-surface " +
  "cursor-pointer font-medium text-[13px] whitespace-nowrap no-underline hover:border-sub " +
  "[&_svg]:size-[15px] disabled:opacity-45 disabled:cursor-not-allowed " +
  "aria-disabled:opacity-45 aria-disabled:cursor-not-allowed";

/** The hover border of the base rule must not repaint filled/tinted variants. */
const VARIANT: Record<ButtonVariant, string> = {
  default: "",
  pri: "bg-navy border-navy hover:border-navy text-surface shadow-(--shadow-btn-pri) hover:bg-navy-h",
  ok: "bg-s-done border-s-done hover:border-s-done text-(--on-done) shadow-(--shadow-btn-ok)",
  warn:
    "text-danger border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] " +
    "hover:border-[color-mix(in_srgb,var(--danger)_40%,var(--line))]",
  ghost: "border-transparent hover:border-transparent bg-transparent text-sub hover:bg-sunk hover:text-ink",
};

const SMALL = "h-7 px-2.5 text-[12px]";

/** Class names for non-button elements that must look like a button (e.g. a file `<label>`). */
export function buttonClassName(variant: ButtonVariant = "default", size: "md" | "sm" = "md"): string {
  return cn(BASE, VARIANT[variant], size === "sm" && SMALL);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /** Renders the single child (e.g. a `<Link>`) with the button look instead of a `<button>`. */
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** `.btn` — h34 (sm h28), radius 7. Variants: pri (navy), ok (done), warn (danger text), ghost. */
export function Button({
  variant = "default",
  size = "md",
  asChild,
  className,
  type = "button",
  disabled,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  // A link has no `disabled`: block it with ARIA, keep it out of the tab order and cancel the click.
  const linkDisabled = asChild && disabled;
  if (asChild) {
    return (
      <Slot.Root
        className={cn(buttonClassName(variant, size), linkDisabled && "pointer-events-none", className)}
        aria-disabled={linkDisabled || undefined}
        tabIndex={linkDisabled ? -1 : undefined}
        onClick={linkDisabled ? (event: MouseEvent) => event.preventDefault() : onClick}
        {...rest}
      />
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(buttonClassName(variant, size), className)}
      {...rest}
    />
  );
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
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "relative grid size-[34px] place-items-center rounded-sm border border-transparent bg-transparent p-0",
        "cursor-pointer text-sub hover:bg-sunk hover:text-ink [&_svg]:size-[18px]",
        className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span
          className={cn(
            "absolute top-[5px] right-[5px] grid h-4 min-w-4 place-items-center rounded-[8px] px-1",
            "border-2 border-surface bg-danger text-[10px] font-semibold text-(--on-danger)",
          )}
          aria-hidden="true"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
