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

/** Option labels of a select, in order (opens and closes the list). */
export function optionLabels(trigger: HTMLElement): string[] {
  fireEvent.keyDown(trigger, { key: "Enter" });
  const labels = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((el) => el.textContent ?? "");
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  return labels;
}
