"use client";

import type { RouteKey } from "@/shared/config/routes";
import { useRequestTotal, viewListParams } from "@/entities/request";

/**
 * Sidebar badge counts (same server aggregates as the dashboard views):
 * 요청 = my drafts + my 확인 요청, 검수 = my reviews + assignments waiting for me as lead,
 * 승인 = approvals I can make. Only visible menus are queried.
 */
export function useMenuCounts(
  projectId: number | null,
  customerId: number | null,
  visible: ReadonlySet<RouteKey>,
): Partial<Record<RouteKey, number>> {
  const scope = { projectId: projectId ?? -1, customerId: customerId ?? -1 };
  const ready = projectId !== null && customerId !== null;
  const onRequests = ready && visible.has("requests");
  const onReview = ready && visible.has("review");
  const onApproval = ready && visible.has("approval");
  const drafts = useRequestTotal(viewListParams("MY_DRAFT", scope, 1), onRequests).data ?? 0;
  const confirming = useRequestTotal(viewListParams("MY_CONFIRMING", scope, 1), onRequests).data ?? 0;
  const reviews = useRequestTotal(viewListParams("MY_REVIEW", scope, 1), onReview).data ?? 0;
  const waiting = useRequestTotal(viewListParams("WAITING_ASSIGNMENT", scope, 1), onReview).data ?? 0;
  const approvals = useRequestTotal(viewListParams("APPROVAL_PENDING", scope, 1), onApproval).data ?? 0;
  return { requests: drafts + confirming, review: reviews + waiting, approval: approvals };
}
