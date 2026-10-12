/** Helpers of the rich text editor values (sanitized HTML from Quill 2, contract §18). */

/** A value written by the editor; plain text (bodies written before the editor) does not start with a tag. */
export function isRichText(value: string): boolean {
  return value.trimStart().startsWith("<");
}

/** Visible text of a value (tags dropped, entities decoded by the DOM when available). */
export function richTextPlain(value: string): string {
  if (!isRichText(value)) return value;
  if (typeof DOMParser === "undefined") return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  return new DOMParser().parseFromString(value, "text/html").body.textContent ?? "";
}

/** No visible text and no image (the editor's empty document is `<p><br></p>`). */
export function isRichTextEmpty(value: string): boolean {
  if (/<img\b/i.test(value)) return false;
  return richTextPlain(value).trim() === "";
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Editor input: rich values as they are, plain text as one paragraph per line. */
export function toRichHtml(value: string): string {
  if (value === "" || isRichText(value)) return value;
  return value
    .split("\n")
    .map((line) => `<p>${line === "" ? "<br>" : escapeHtml(line)}</p>`)
    .join("");
}

/** Image files the editor embeds (contract §18). */
export const RICH_TEXT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const RICH_TEXT_IMAGE_MAX_BYTES = 1024 * 1024;
export const RICH_TEXT_IMAGE_TOO_LARGE = "이미지는 1MB 이하만 넣을 수 있습니다";
export const RICH_TEXT_IMAGE_TYPE = "PNG, JPG, GIF, WEBP 이미지만 넣을 수 있습니다";
