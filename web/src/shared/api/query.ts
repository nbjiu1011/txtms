import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./api-error";

/** Query key conventions: `[resource, 'list', params]` / `[resource, 'detail', id]`. */
export const queryKeys = {
  all: (resource: string) => [resource] as const,
  list: <P>(resource: string, params: P) => [resource, "list", params] as const,
  detail: (resource: string, id: string | number) => [resource, "detail", id] as const,
};

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
}
