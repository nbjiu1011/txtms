/**
 * Returns an in-app path from a `next` query value, or the fallback.
 * Rejects absolute/protocol-relative URLs and auth pages (open-redirect guard).
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/^\/(login|invite|reset)(\/|$|\?)/.test(value)) return fallback;
  return value;
}
