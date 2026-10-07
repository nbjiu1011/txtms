/** How long the editor control keeps the highlight ring (reference `focusIssue`, 1.4s). */
export const FLASH_MS = 1400;

/**
 * Selects `[start, end)` of the text control bound to `field` (`data-path`) inside `root`, scrolls
 * it into view and flashes it. A disabled control (read-only viewer) cannot take focus or a
 * selection, so it is only scrolled to and flashed. Returns false when the control is not rendered.
 */
export function selectRange(root: ParentNode | null, field: string, start: number, end: number): boolean {
  if (!root) return false;
  const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-path="${CSS.escape(field)}"]`);
  if (!el) return false;
  el.scrollIntoView?.({ block: "center", behavior: "smooth" });
  if (!el.disabled) {
    el.focus({ preventScroll: true });
    el.setSelectionRange(start, end);
  }
  el.setAttribute("data-flash", "");
  window.setTimeout(() => el.removeAttribute("data-flash"), FLASH_MS);
  return true;
}
