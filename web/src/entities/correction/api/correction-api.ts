import { useQuery } from "@tanstack/react-query";
import { http, queryKeys } from "@/shared/api";
import type {
  CorrectionCheckItem,
  CorrectionDataset,
  CorrectionEvent,
  CorrectionResult,
  CorrectionSuggestion,
} from "../model/types";

const base = (requestId: string) => `/requests/${encodeURIComponent(requestId)}/corrections`;

export const correctionKeys = {
  dataset: (requestId: string) => queryKeys.detail("correction-dataset", requestId),
};

/** Correction endpoints (contract §6). Results are not stored on the server. */
export const correctionApi = {
  dataset: (requestId: string) => http.get<CorrectionDataset>(`${base(requestId)}/dataset`),
  check: (requestId: string, contents: CorrectionCheckItem[]) =>
    http.post<{ results: CorrectionResult[] }>(`${base(requestId)}/check`, { contents }),
  event: (requestId: string, body: CorrectionEvent) => http.post<void>(`${base(requestId)}/events`, body),
  suggest: (requestId: string, body: CorrectionSuggestion) => http.post<void>(`${base(requestId)}/suggestions`, body),
};

/** Dataset label of the correction panel head. */
export function useCorrectionDataset(requestId: string) {
  return useQuery({
    queryKey: correctionKeys.dataset(requestId),
    queryFn: () => correctionApi.dataset(requestId),
    staleTime: 5 * 60_000,
  });
}
