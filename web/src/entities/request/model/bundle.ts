import { normalizePayload, resolveVariables } from "./payload";
import type {
  AlimtalkPayload,
  BundleItem,
  BundleVariable,
  ContentPayload,
  ContentType,
  FreeformPayload,
  RcsPayload,
  SmsPayload,
} from "./types";

/**
 * Message body of a content (what 복사 copies): 알림톡·문자 `body`, RCS card bodies joined by line
 * breaks, 자유입력형 `text`. Titles and buttons are not part of it.
 */
export function messageBodyText(type: ContentType, payload: ContentPayload): string {
  const p = normalizePayload(type, payload);
  switch (type) {
    case "ALIMTALK":
      return (p as AlimtalkPayload).body;
    case "SMS":
      return (p as SmsPayload).body;
    case "RCS":
      return (p as RcsPayload).cards.map((c) => c.body).join("\n");
    case "FREEFORM":
      return (p as FreeformPayload).text;
  }
}

/** `#{key}` → value map of the completion-time variables (later variable changes do not apply). */
export function bundleVariableValues(variables: readonly BundleVariable[]): Map<string, string> {
  return new Map(variables.map((v) => [v.key, v.value]));
}

/**
 * Text copied for a completed item: its message body with every `#{key}` replaced by the value the
 * variable had at completion (unknown keys stay tokens).
 */
export function completedCopyText(
  type: ContentType,
  item: Pick<BundleItem, "payload">,
  variables: readonly BundleVariable[],
): string {
  return resolveVariables(messageBodyText(type, item.payload), bundleVariableValues(variables));
}
