import { useCallback, useState } from "react";
import { serverFormError, type ServerFormError } from "@/shared/api";
import { toast } from "@/shared/ui";

const EMPTY: ServerFormError = { code: "", message: "", fields: {}, details: [] };

/**
 * Server answer of a modal submit: the message as a toast (reference behaviour), `fieldErrors` under
 * their fields and `details` as a list in the modal. `fail` returns false so the modal stays open.
 */
export function useServerError(fallback: string) {
  const [error, setError] = useState<ServerFormError>(EMPTY);
  const fail = useCallback(
    (thrown: unknown): false => {
      const next = serverFormError(thrown, fallback);
      setError(next);
      toast(next.message);
      return false;
    },
    [fallback],
  );
  /** Shows a client-side refusal the same way (toast, optional field message). */
  const reject = useCallback((message: string, field?: string): false => {
    setError({ code: "CLIENT", message, fields: field ? { [field]: message } : {}, details: [] });
    toast(message);
    return false;
  }, []);
  const clear = useCallback(() => setError(EMPTY), []);
  /** Drops the message under a field once the user edits it (the rest of the refusal stays). */
  const clearField = useCallback(
    (key: string) =>
      setError((current) => {
        if (!(key in current.fields)) return current;
        const fields = { ...current.fields };
        const removed = fields[key];
        delete fields[key];
        // the message shown under that field is answered too (it must not move to the modal footer)
        return { ...current, fields, message: removed === current.message ? "" : current.message };
      }),
    [],
  );
  return {
    error,
    fail,
    reject,
    clear,
    clearField,
    field: (key: string) => error.fields[key],
    /** Message + details shown in the modal unless the message already sits under a field. */
    inline: inlineError(error),
  };
}

/** Modal-level part of a refusal: the message (when no field shows it) and the detail items. */
export function inlineError(error: ServerFormError): { message: string; items: string[] } {
  if (!error.message) return { message: "", items: [] };
  const underField = Object.values(error.fields).includes(error.message);
  if (error.code === "CLIENT") return { message: "", items: [] };
  return { message: underField ? "" : error.message, items: error.details };
}
