import { fireEvent, screen } from "@testing-library/react";

/**
 * Test helpers for the radix-based controls (not exported from the slice index: tests import this file).
 * The `Select` trigger is a `<button role="combobox">`, so `fireEvent.change` / `.value` no longer apply.
 */

/** Opens the select with the keyboard and picks the option whose `value` is `value` ("" = the empty option). */
export function chooseValue(trigger: HTMLElement, value: string | number): void {
  fireEvent.keyDown(trigger, { key: "Enter" });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (el) => el.dataset.value === String(value),
  );
  if (!option) throw new Error(`no option with value "${value}" in ${trigger.id || trigger.getAttribute("aria-label")}`);
  fireEvent.click(option);
}

/** Opens the select with the keyboard and picks the option with this accessible name. */
export function chooseOption(trigger: HTMLElement, name: string | RegExp): void {
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name }));
}

/** The selected value of a select trigger (`""` when nothing is selected). */
export function selectValue(trigger: HTMLElement): string {
  return trigger.dataset.value ?? "";
}

/** Moves the open calendar to the month of `value` and clicks that day. */
function clickDay(value: string): void {
  const [year, month] = value.split("-").map(Number);
  for (let i = 0; i < 600; i++) {
    const grid = document.querySelector<HTMLElement>('[role="grid"]');
    if (!grid) throw new Error("the calendar is not open");
    const [gy, gm] = (grid.getAttribute("aria-label") ?? "").match(/\d+/g)?.map(Number) ?? [0, 0];
    if (gy === year && gm === month) {
      const day = grid.querySelector<HTMLElement>(`[data-day="${value}"]`);
      if (!day) throw new Error(`no day ${value}`);
      fireEvent.click(day);
      return;
    }
    fireEvent.click(screen.getByRole("button", { name: gy * 12 + gm < year * 12 + month ? "다음 달" : "이전 달" }));
  }
  throw new Error(`could not reach ${value}`);
}

/** Picks a day in a `DatePicker` (`""` clears it with 지우기). */
export function pickDate(trigger: HTMLElement, value: string): void {
  fireEvent.click(trigger);
  if (value === "") {
    fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    return;
  }
  clickDay(value);
}

/** Picks a period in a `DateRangePicker`/`DateRangeFilter` (both "" = 전체 기간). */
export function pickRange(trigger: HTMLElement, from: string, to: string): void {
  fireEvent.click(trigger);
  if (!from && !to) {
    fireEvent.click(screen.getByRole("button", { name: "전체 기간" }));
    return;
  }
  clickDay(from);
  clickDay(to);
}

/** Option labels of a select, in order (opens and closes the list). */
export function optionLabels(trigger: HTMLElement): string[] {
  fireEvent.keyDown(trigger, { key: "Enter" });
  const labels = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((el) => el.textContent ?? "");
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  return labels;
}
