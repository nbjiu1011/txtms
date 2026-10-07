import { useMemo } from "react";
import type { UserSummary } from "../model/types";
import { useCustomerUsers } from "./user-queries";

export interface UserDirectory {
  get: (id: number | null | undefined) => UserSummary | undefined;
  /** Display name; `-` when unknown. */
  name: (id: number | null | undefined) => string;
  ready: boolean;
}

/** Id → user lookup of a customer's users (names and avatar colors in lists and headers). */
export function useUserDirectory(customerId: number | null): UserDirectory {
  const { data, isSuccess } = useCustomerUsers(customerId);
  return useMemo(() => {
    const map = new Map<number, UserSummary>((data ?? []).map((u) => [u.id, u]));
    const get = (id: number | null | undefined) => (id === null || id === undefined ? undefined : map.get(id));
    return { get, name: (id) => get(id)?.name ?? "-", ready: isSuccess };
  }, [data, isSuccess]);
}
