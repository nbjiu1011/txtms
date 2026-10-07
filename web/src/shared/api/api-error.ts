/** Error codes returned by the API error body. */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "REQUEST_STATE_CONFLICT"
  | "VERSION_CONFLICT"
  | "LOCKED_BY_OTHER"
  | "DUPLICATE"
  | "LIMIT_EXCEEDED"
  | "NO_ELIGIBLE_APPROVER"
  | "DATASET_NOT_ASSIGNED"
  | "FILE_REJECTED"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "NETWORK_ERROR"
  | (string & {});

export interface FieldError {
  field: string;
  message: string;
}

/** Wire shape of an error response. */
export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: FieldError[];
  details?: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldError[];
  readonly details: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? [];
    this.details = body.details ?? [];
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

const FALLBACK_MESSAGE = "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요";

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "REQUEST_STATE_CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "VALIDATION_FAILED";
  return "INTERNAL";
}

/** Normalises any error body into the contract shape. */
export function toApiErrorBody(status: number, payload: unknown): ApiErrorBody {
  if (payload && typeof payload === "object") {
    const p = payload as Partial<ApiErrorBody>;
    if (typeof p.code === "string" && typeof p.message === "string") {
      return {
        code: p.code,
        message: p.message,
        fieldErrors: Array.isArray(p.fieldErrors) ? p.fieldErrors : undefined,
        details: Array.isArray(p.details) ? p.details : undefined,
      };
    }
  }
  return { code: codeForStatus(status), message: FALLBACK_MESSAGE };
}
