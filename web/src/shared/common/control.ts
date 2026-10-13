/**
 * Shared surface of the form controls (`.in` / `.sel` / `.ta` of the reference).
 *
 * Inputs, selects and textareas that sit on one row must share the same box: keep the height,
 * border, padding and focus ring here instead of repeating them per control. Tailwind preflight is
 * not loaded, so the browser chrome of `<button>` (used by the select trigger) is reset explicitly.
 */
export const CONTROL_CLASS =
  "w-full min-h-[34px] rounded-sm border border-line2 bg-surface px-2.5 py-[7px] text-left " +
  "focus:border-focus focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_18%,transparent)] focus:outline-none " +
  "disabled:bg-sunk disabled:text-sub aria-invalid:border-danger";

/** Textarea additions: vertical resize, taller, looser line height; read-only looks like disabled. */
export const TEXTAREA_CLASS = "resize-y min-h-[120px] leading-[1.6] read-only:bg-sunk read-only:text-sub";
