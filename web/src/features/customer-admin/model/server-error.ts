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
  const clear = useCallback(() => setError(EMPTY), []);
  return {
    error,
    fail,
    clear,
    field: (key: string) => error.fields[key],
    /** Message + details shown in the modal unless the message already sits under a field. */
    inline: inlineError(error),
  };
}

/** Modal-level part of a refusal: the message (when no field shows it) and the detail items. */
export function inlineError(error: ServerFormError): { message: string; items: string[] } {
  if (!error.message) return { message: "", items: [] };
  const underField = Object.values(error.fields).includes(error.message);
  return { message: underField ? "" : error.message, items: error.details };
}
