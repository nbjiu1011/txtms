"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { invalidateRequestViews, requestApi, storeRequestDetail, type RequestDetail } from "@/entities/request";

export const FOLLOW_UP_CREATED = "완료본과 연결된 후속 요청을 만들었습니다";

/** Opens the work tab of a request (the shell's `openTab`). */
export type OpenRequestTab = (requestId: string) => void;

/** Whether a new work tab can be opened (the shell's tab limit); tells the user why not. */
export type CanOpenTab = () => boolean;

function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

/**
 * Creates a draft (`POST /api/requests`, first active type when omitted) or a copy of a request
 * (`POST /api/requests/{id}/clone`) and opens its tab. A pending call ignores repeated clicks so a
 * double click never creates two drafts, and nothing is created while no tab can be opened for it (the
 * draft would be left behind unseen on every click).
 */
export function useRequestCreate(openRequest: OpenRequestTab, canOpenTab: CanOpenTab) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = async (call: () => Promise<RequestDetail>, fallback: string, success?: string) => {
    if (pending || !canOpenTab()) return;
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
    /**
     * Follow-up draft of a completed request: the whole completion bundle (`contentKey` null) or one
     * item. Each new content keeps its own link to the completed original.
     */
    followUp: (requestId: string, contentKey: string | null = null) =>
      run(
        () => requestApi.followUp(requestId, contentKey),
        "후속 요청을 만들지 못했습니다",
        FOLLOW_UP_CREATED,
      ),
  };
}
