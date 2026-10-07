"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { invalidateRequestViews, requestApi, storeRequestDetail, type RequestDetail } from "@/entities/request";

/** Opens the work tab of a request (the shell's `openTab`). */
export type OpenRequestTab = (requestId: string) => void;

function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

/**
 * Creates a draft (`POST /api/requests`, first active type when omitted) or a copy of a request
 * (`POST /api/requests/{id}/clone`) and opens its tab. A pending call ignores repeated clicks so a
 * double click never creates two drafts.
 */
export function useRequestCreate(openRequest: OpenRequestTab) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = async (call: () => Promise<RequestDetail>, fallback: string, success?: string) => {
    if (pending) return;
    setPending(true);
    try {
      const detail = await call();
      storeRequestDetail(client, detail);
      invalidateRequestViews(client);
      if (success) toast(success);
      openRequest(detail.id);
    } catch (error) {
      toast(messageOf(error, fallback));
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    create: (projectId: number) =>
      run(() => requestApi.create({ projectId }), "요청을 만들지 못했습니다"),
    clone: (requestId: string) =>
      run(() => requestApi.clone(requestId), "요청을 복제하지 못했습니다", "새 작성 중 요청을 만들었습니다"),
  };
}
