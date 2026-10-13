"use client";

import { Select as RSelect } from "radix-ui";
import {
  Children,
  Fragment,
  isValidElement,
  type ButtonHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/shared/lib";
import { CONTROL_CLASS } from "./control";

/**
 * radix does not allow an empty item value (it is reserved for "nothing selected"), but our selects use
 * `<option value="">전체</option>`. Such an option is stored under this key and mapped back to "".
 */
const EMPTY_VALUE = "__empty__";

export interface SelectChangeEvent {
  target: { value: string; name: string };
}

interface SelectItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "type"> {
  value?: string | number;
  defaultValue?: string | number;
  /** Same shape as a native change event's `target` so callers read `e.target.value`. */
  onChange?: (event: SelectChangeEvent) => void;
  /** Shown when the value matches no option (and there is no `value=""` option). */
  placeholder?: ReactNode;
  required?: boolean;
  /** `<option value disabled>label</option>` elements (arrays and fragments are flattened). */
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

function collectItems(children: ReactNode, out: SelectItem[] = []): SelectItem[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<OptionHTMLAttributes<HTMLOptionElement> & { children?: ReactNode }>;
    if (element.type === Fragment) {
      collectItems(element.props.children, out);
    } else if (element.type === "option") {
      const raw = element.props.value ?? textOf(element.props.children);
      const value = String(raw);
      out.push({
        value: value === "" ? EMPTY_VALUE : value,
        label: element.props.children,
        disabled: element.props.disabled,
      });
    }
  });
  return out;
}

const toItemValue = (value: string | number | undefined) =>
  value === undefined ? undefined : String(value) === "" ? EMPTY_VALUE : String(value);

/**
 * `.sel` — single select on radix Select: the list is styled like the rest of the UI while radix keeps the
 * keyboard handling, typeahead and ARIA (`combobox` trigger + `listbox`).
 * Options are written as native `<option>` children; `onChange` receives `{ target: { value, name } }`.
 */
export function Select({
  id,
  name = "",
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  className,
  children,
  ref,
  ...rest
}: SelectProps) {
  const items = collectItems(children);
  const current = toItemValue(value);
  // A value with no matching option shows the placeholder (radix renders nothing for an unknown value).
  const known = current === undefined || items.some((item) => item.value === current);

  return (
    <RSelect.Root
      value={current === undefined ? undefined : known ? current : ""}
      defaultValue={toItemValue(defaultValue)}
      onValueChange={(next) => {
        // radix reports "" when its hidden form input is reset; our own items never use "".
        if (next === "") return;
        onChange?.({ target: { value: next === EMPTY_VALUE ? "" : next, name } });
      }}
      name={name || undefined}
      required={required}
      disabled={disabled}
    >
      <RSelect.Trigger
        ref={ref}
        id={id}
        // the selected value, for tests and end-to-end scripts (the trigger is a button, not a <select>)
        data-value={value === undefined ? undefined : String(value)}
        className={cn(
          CONTROL_CLASS,
          "flex cursor-default items-center justify-between gap-2 data-placeholder:text-faint",
          className,
        )}
        {...rest}
      >
        {/*
          Like a native select: the text starts 4px inside the padding, the line box is a whole 22px (the box is
          38px like `.in`), and the width fits the widest option (hidden copies share the grid cell), so an
          auto-width filter select does not change size with the selection.
        */}
        <span className="ml-1 grid min-w-0 grid-cols-[minmax(0,1fr)] leading-[22px]">
          <span className="col-start-1 row-start-1 truncate">
            <RSelect.Value placeholder={placeholder} />
          </span>
          {items.map((item) => (
            <span key={item.value} aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 whitespace-nowrap">
              {item.label}
            </span>
          ))}
        </span>
        <RSelect.Icon className="-mr-1.5 grid shrink-0 place-items-center text-ink">
          <Chevron />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className={cn(
            "z-70 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)",
            "overflow-hidden rounded-md border border-line bg-surface shadow-pop",
          )}
        >
          <RSelect.Viewport className="p-1">
            {items.map((item) => (
              <RSelect.Item
                key={item.value}
                value={item.value}
                data-value={item.value === EMPTY_VALUE ? "" : item.value}
                disabled={item.disabled}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-sm py-1.5 pr-2.5 pl-7 text-[13px] outline-none select-none",
                  "data-highlighted:bg-sunk data-[state=checked]:font-medium",
                  "data-disabled:cursor-not-allowed data-disabled:opacity-45",
                )}
              >
                <RSelect.ItemIndicator className="absolute left-2 grid place-items-center text-navy">
                  <Check />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{item.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/** Same size and weight as Chrome's native select arrow (9×5, bold). */
function Chevron() {
  return (
    <svg width="11" height="7" viewBox="0 0 11 7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1.5 1.5l4 4 4-4" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
