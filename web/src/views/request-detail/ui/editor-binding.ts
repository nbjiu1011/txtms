import { setPayloadField, type ContentPayload } from "@/entities/request";

export interface FieldsProps<P> {
  payload: P;
  disabled: boolean;
  /** Draft editing: next payload on change. Absent = read-only. */
  onPayload?: (payload: P) => void;
}

/**
 * Props of a text control bound to a payload path. `data-path` lets the variable picker insert at
 * the caret of the last focused field.
 */
export function bindText<P extends ContentPayload>(payload: P, path: string, onPayload: ((p: P) => void) | undefined) {
  return {
    "data-path": path,
    readOnly: !onPayload,
    onChange: (e: { target: { value: string } }) => onPayload?.(setPayloadField(payload, path, e.target.value)),
  };
}
