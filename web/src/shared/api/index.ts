export { ApiError, isApiError, toApiErrorBody } from "./api-error";
export type { ApiErrorBody, ApiErrorCode, FieldError } from "./api-error";
export { accessTokenStore, getAccessToken, setAccessToken } from "./access-token";
export { buildUrl, configureHttpClient, downloadFile, http, refreshSession, request } from "./http-client";
export type { HttpHandlers, QueryParams, RequestOptions, SessionPayload } from "./http-client";
export { createQueryClient, queryKeys } from "./query";

/** Spring-style page wrapper of list endpoints. */
export interface Page<T> {
  content: T[];
  page: { number: number; size: number; totalElements: number; totalPages: number };
}
