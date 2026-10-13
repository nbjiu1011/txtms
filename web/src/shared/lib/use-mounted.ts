"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration (portals need `document`). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
