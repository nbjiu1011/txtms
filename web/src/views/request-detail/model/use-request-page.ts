"use client";

import { useMemo } from "react";
import { isApiError } from "@/shared/api";
import { useCustomers, type Customer } from "@/entities/customer";
import { useProject, type Project } from "@/entities/project";
import { useContentTypes, useRequestDetail, type RequestDetail } from "@/entities/request";
import { useUserDirectory, type UserDirectory } from "@/entities/user";
import { useProjectVariables } from "@/entities/variable";

export type RequestPageState =
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string; retry: () => void }
  | { kind: "ready"; page: RequestPage };

export interface RequestPage {
  request: RequestDetail;
  project: Project | null;
  customer: Customer | null;
  users: UserDirectory;
  /** Values for `#{key}` substitution: completion snapshot when final, else project variables. */
  variableValues: ReadonlyMap<string, string>;
  mockEnabled: boolean;
}

/** Loads a request with everything its screen displays (project, customer, users, variables). */
export function useRequestPage(id: string): RequestPageState {
  const detail = useRequestDetail(id);
  const request = detail.data;
  const projectQuery = useProject(request?.projectId ?? null);
  const project = projectQuery.data ?? null;
  const customers = useCustomers();
  const users = useUserDirectory(project?.customerId ?? null);
  const final = !!request?.bundle;
  const variables = useProjectVariables(request?.projectId ?? null, !!request && !final);
  const types = useContentTypes();

  const variableValues = useMemo(() => {
    if (request?.bundle) return new Map(request.bundle.variables.map((v) => [v.key, v.value]));
    return new Map((variables.data ?? []).filter((v) => v.active).map((v) => [v.key, v.value]));
  }, [request, variables.data]);

  if (detail.isPending) return { kind: "loading" };
  if (detail.isError) {
    const error = detail.error;
    if (isApiError(error) && error.status === 404) return { kind: "notFound" };
    if (isApiError(error) && error.status === 403) return { kind: "forbidden" };
    return { kind: "error", message: error.message, retry: () => void detail.refetch() };
  }
  if (!request) return { kind: "loading" };
  const typeSetting = types.data?.find((t) => t.type === request.type);
  return {
    kind: "ready",
    page: {
      request,
      project,
      customer: customers.data?.find((c) => c.id === project?.customerId) ?? null,
      users,
      variableValues,
      mockEnabled: typeSetting ? typeSetting.mockEnabled : request.type !== "FREEFORM",
    },
  };
}
