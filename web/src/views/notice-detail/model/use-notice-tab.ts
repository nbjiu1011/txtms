"use client";

import { useEffect } from "react";
import { isApiError } from "@/shared/api";
import { useNotice } from "@/entities/notice";
import type { WorkViewProps } from "@/widgets/app-shell";

/** The notice of a detail tab (`params.id`), its tab title, and whether it is missing (404 or a bad id). */
export function useNoticeTab({ tab, setTitle }: Pick<WorkViewProps, "tab" | "setTitle">) {
  const parsed = Number(tab.params.id);
  const id = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const notice = useNotice(id);
  const title = notice.data?.title ?? null;
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
  const missing = id === null || (notice.isError && isApiError(notice.error) && notice.error.status === 404);
  return { notice, missing };
}
