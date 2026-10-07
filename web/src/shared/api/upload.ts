import { ApiError, toApiErrorBody } from "./api-error";
import { getAccessToken } from "./access-token";
import { buildUrl, endSession, refreshSession } from "./http-client";

export interface UploadOptions {
  /** Multipart field name (default `file`). */
  field?: string;
  headers?: Record<string, string>;
  /** Called once the request body has been sent (the server is now inspecting the file). */
  onSent?: () => void;
  signal?: AbortSignal;
}

interface XhrResult {
  status: number;
  contentType: string;
  text: string;
}

function sendOnce(path: string, body: FormData, options: UploadOptions): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.setRequestHeader("Accept", "application/json");
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    for (const [name, value] of Object.entries(options.headers ?? {})) xhr.setRequestHeader(name, value);
    xhr.upload.onload = () => options.onSent?.();
    xhr.onload = () =>
      resolve({ status: xhr.status, contentType: xhr.getResponseHeader("content-type") ?? "", text: xhr.responseText });
    xhr.onerror = () =>
      reject(new ApiError(0, { code: "NETWORK_ERROR", message: "서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요" }));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

function parse(result: XhrResult): unknown {
  if (!result.text || !result.contentType.includes("json")) return result.text || undefined;
  try {
    return JSON.parse(result.text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Multipart upload of one file with the bearer token (XHR, so the caller learns when the body has
 * been sent). On 401 the session is refreshed once and the upload retried, like the JSON client.
 */
export async function uploadFile<T>(path: string, file: Blob, options: UploadOptions = {}): Promise<T> {
  const form = () => {
    const body = new FormData();
    body.append(options.field ?? "file", file, file instanceof File ? file.name : "file");
    return body;
  };
  let result = await sendOnce(path, form(), options);
  if (result.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) result = await sendOnce(path, form(), options);
    if (result.status === 401) {
      const error = new ApiError(401, toApiErrorBody(401, parse(result)));
      endSession(error);
      throw error;
    }
  }
  const payload = parse(result);
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, toApiErrorBody(result.status, payload));
  }
  return payload as T;
}
