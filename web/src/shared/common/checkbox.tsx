"use client";

import { Checkbox as RCheckbox } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/shared/lib";

export interface CheckboxChangeEvent {
  target: { checked: boolean; name: string };
}

export interface CheckboxProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue" | "type"> {
  label: ReactNode;
  labelClassName?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Same shape as a native change event's `target` so callers read `e.target.checked`. */
  onChange?: (event: CheckboxChangeEvent) => void;
  /** Shows the state but ignores clicks (like a read-only native checkbox). */
  readOnly?: boolean;
  required?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** `.chk` — inline checkbox with label (navy when checked), on radix Checkbox. */
export function Checkbox({
  label,
  labelClassName,
  className,
  name = "",
  checked,
  defaultChecked,
  onChange,
  readOnly,
  disabled,
  required,
  ref,
  ...rest
}: CheckboxProps) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-[7px] text-[13px]", labelClassName)}>
      <RCheckbox.Root
        ref={ref}
        name={name || undefined}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        aria-readonly={readOnly || undefined}
        onCheckedChange={(next) => {
          if (readOnly) return;
          onChange?.({ target: { checked: next === true, name } });
        }}
        className={cn(
          "my-[3px] mr-[3px] ml-1 grid size-4 shrink-0 cursor-pointer place-items-center p-0",
          "rounded-(--r-3) border border-sub bg-surface text-(--on-navy)",
          "data-[state=checked]:border-navy data-[state=checked]:bg-navy",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        <RCheckbox.Indicator>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      {label}
    </label>
  );
}
