"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import type { TabRef } from "@/shared/config/routes";
import { toast } from "@/shared/ui";
import { useWorkContextStore } from "@/entities/me";
import { fetchProject, projectKeys } from "@/entities/project";
import { fetchRequestDetail, requestKeys } from "@/entities/request";

/** Message when a notified request cannot be viewed (403/404). */
export const NOTIFIED_REQUEST_DENIED = "이 요청을 볼 권한이 없습니다";

/**
 * Notification click: loads the request (and its project), switches the customer/project
 * context to it and opens its tab. Resolves false (with a toast) when it cannot be viewed.
 */
export function useOpenNotifiedRequest(navigate: (ref: TabRef) => void) {
  const queryClient = useQueryClient();
  return useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: requestKeys.detail(id),
          queryFn: () => fetchRequestDetail(id),
          staleTime: 0,
        });
        const project = await queryClient.fetchQuery({
          queryKey: projectKeys.detail(detail.projectId),
          queryFn: () => fetchProject(detail.projectId),
        });
        useWorkContextStore.getState().setCustomer(project.customerId, project.id);
      } catch (error) {
        if (isApiError(error) && (error.status === 403 || error.status === 404)) {
          toast(NOTIFIED_REQUEST_DENIED);
        } else {
          toast(error instanceof Error && error.message ? error.message : "요청을 열지 못했습니다");
        }
        return false;
      }
      navigate({ route: "request", params: { id } });
      return true;
    },
    [queryClient, navigate],
  );
}
