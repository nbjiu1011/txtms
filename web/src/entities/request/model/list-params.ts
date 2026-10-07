import type { ContentType, RequestListParams, RequestListView, RequestStatus } from "./types";

/** Filter state of the request list screen (all controls of the reference filter bar). */
export interface RequestFilters {
  q: string;
  type: ContentType | "";
  status: RequestStatus | "";
  leadUserId: number | null;
  primaryReviewerId: number | null;
  reviewerId: number | null;
  /** KST dates `YYYY-MM-DD` (inclusive). */
  dueFrom: string;
  dueTo: string;
  submittedFrom: string;
  submittedTo: string;
  mine: boolean;
}

export const EMPTY_REQUEST_FILTERS: RequestFilters = {
  q: "",
  type: "",
  status: "",
  leadUserId: null,
  primaryReviewerId: null,
  reviewerId: null,
  dueFrom: "",
  dueTo: "",
  submittedFrom: "",
  submittedTo: "",
  mine: false,
};

/** Rows the list screen shows at once (the reference shows the whole project list). */
export const REQUEST_LIST_PAGE_SIZE = 100;

/** Maps the filter state to `GET /api/requests` query params (empty values are omitted). */
export function filtersToListParams(projectId: number, filters: RequestFilters, page = 0): RequestListParams {
  const params: RequestListParams = { projectId, page, size: REQUEST_LIST_PAGE_SIZE };
  const q = filters.q.trim();
  if (q) params.q = q;
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.leadUserId !== null) params.leadUserId = filters.leadUserId;
  if (filters.primaryReviewerId !== null) params.primaryReviewerId = filters.primaryReviewerId;
  if (filters.reviewerId !== null) params.reviewerId = filters.reviewerId;
  if (filters.dueFrom) params.dueFrom = filters.dueFrom;
  if (filters.dueTo) params.dueTo = filters.dueTo;
  if (filters.submittedFrom) params.submittedFrom = filters.submittedFrom;
  if (filters.submittedTo) params.submittedTo = filters.submittedTo;
  if (filters.mine) params.mine = true;
  return params;
}

/** Views scoped to the whole customer (`customerId` instead of `projectId`). */
export const CUSTOMER_SCOPED_VIEWS: readonly RequestListView[] = ["CUSTOMER_IN_PROGRESS", "CUSTOMER_COMPLETED"];

export interface ListScope {
  projectId: number;
  customerId: number;
}

/** Query of a dashboard KPI / menu count: same `view` as the server aggregate. */
export function viewListParams(view: RequestListView, scope: ListScope, size = REQUEST_LIST_PAGE_SIZE): RequestListParams {
  return CUSTOMER_SCOPED_VIEWS.includes(view)
    ? { customerId: scope.customerId, view, page: 0, size }
    : { projectId: scope.projectId, view, page: 0, size };
}

/** Query of a pipeline stage: project requests in one status (others' drafts are never listed). */
export function statusListParams(projectId: number, status: RequestStatus, size = REQUEST_LIST_PAGE_SIZE): RequestListParams {
  return { projectId, status, page: 0, size };
}
