"use client";

import { useEffect } from "react";
import { isApiError } from "@/shared/api";
import { useMember } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";

/** The user of a detail tab (`params.id`) in the selected customer, its tab title, and whether it is missing. */
export function useUserTab({ tab, setTitle, customerId }: Pick<WorkViewProps, "tab" | "setTitle"> & {
  customerId: number | null;
}) {
  const parsed = Number(tab.params.id);
  const id = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const member = useMember(customerId, id);
  const title = member.data?.user.name ?? null;
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
  const missing = id === null || (member.isError && isApiError(member.error) && member.error.status === 404);
  return { id, member, missing };
}
