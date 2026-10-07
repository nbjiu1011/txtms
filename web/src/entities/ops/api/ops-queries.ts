import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, uploadFile, type Page } from "@/shared/api";
import type { AuditLog, OutboxMail } from "@/entities/audit/@x/ops";
import type { Project, ProjectTemplate } from "@/entities/project/@x/ops";
import type { ContentType, ContentTypeSetting } from "@/entities/request/@x/ops";
import type { Member } from "@/entities/user/@x/ops";
import type {
  CustomerCreate,
  Dataset,
  DatasetAssignment,
  DatasetCreate,
  DatasetDetail,
  OpsAuditParams,
  OpsCustomer,
  OpsDashboard,
  OpsInvitation,
  SampleOverview,
  SampleRequest,
  SampleRequestCreate,
  SampleResetResult,
  SetupLog,
  SetupProjectCreate,
} from "../model/types";

/**
 * Operator query keys share the `ops` prefix so one invalidation refreshes every operator screen after
 * a write (`[ops, resource, 'list'|'detail', params]`).
 */
export const opsKeys = {
  all: ["ops"] as const,
  dashboard: () => ["ops", "dashboard", "detail", "me"] as const,
  customers: () => ["ops", "customers", "list", {}] as const,
  contentTypes: () => ["ops", "content-types", "list", {}] as const,
  datasets: () => ["ops", "datasets", "list", {}] as const,
  dataset: (id: number) => ["ops", "datasets", "detail", id] as const,
  assignments: () => ["ops", "dataset-assignments", "list", {}] as const,
  setupLogs: (customerId: number) => ["ops", "setup-logs", "list", { customerId }] as const,
  auditLogs: (params: OpsAuditParams) => ["ops", "audit-logs", "list", params] as const,
  outbox: (page: number, size: number) => ["ops", "outbox", "list", { page, size }] as const,
  samples: (customerId: number) => ["ops", "sample-requests", "list", { customerId }] as const,
};

/** 운영 대시보드 (`GET /api/ops/dashboard`). */
export function useOpsDashboard(enabled = true) {
  return useQuery({ queryKey: opsKeys.dashboard(), queryFn: () => http.get<OpsDashboard>("/ops/dashboard"), enabled });
}

/** Every customer with operator counts, inactive ones included (id order). */
export function useOpsCustomers() {
  return useQuery({ queryKey: opsKeys.customers(), queryFn: () => http.get<OpsCustomer[]>("/ops/customers") });
}

export function useOpsContentTypes() {
  return useQuery({
    queryKey: opsKeys.contentTypes(),
    queryFn: () => http.get<ContentTypeSetting[]>("/ops/content-types"),
  });
}

/** Datasets by scope (enum order), newest version first. */
export function useDatasets() {
  return useQuery({ queryKey: opsKeys.datasets(), queryFn: () => http.get<Dataset[]>("/ops/datasets") });
}

/** One dataset with its rules (row order). Versions never change, so it is cached for long. */
export function useDatasetDetail(id: number | null) {
  return useQuery({
    queryKey: opsKeys.dataset(id ?? -1),
    queryFn: () => http.get<DatasetDetail>(`/ops/datasets/${id}`),
    enabled: id !== null,
    staleTime: 10 * 60_000,
  });
}

export function useDatasetAssignments() {
  return useQuery({
    queryKey: opsKeys.assignments(),
    queryFn: () => http.get<DatasetAssignment[]>("/ops/dataset-assignments"),
  });
}

/** 설정 이력 of a customer, newest first (max 500). */
export function useSetupLogs(customerId: number | null) {
  return useQuery({
    queryKey: opsKeys.setupLogs(customerId ?? -1),
    queryFn: () => http.get<SetupLog[]>("/ops/setup-logs", { query: { customerId } }),
    enabled: customerId !== null,
  });
}

/** 운영 이력: every customer (`customerId` null) or one, newest first. */
export function useOpsAuditLogs(params: OpsAuditParams) {
  return useQuery({
    queryKey: opsKeys.auditLogs(params),
    queryFn: () => http.get<Page<AuditLog>>("/ops/audit-logs", { query: { ...params } }),
    placeholderData: keepPreviousData,
  });
}

/** Every queued mail, newest first; token links are masked outside demo mode. */
export function useOpsOutbox(page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.outbox(page, size),
    queryFn: () => http.get<Page<OutboxMail>>("/ops/outbox", { query: { page, size } }),
    placeholderData: keepPreviousData,
  });
}

/** Sample requests of a (sample) customer and the count of real requests the cleanup keeps. */
export function useSampleOverview(customerId: number | null, enabled = true) {
  return useQuery({
    queryKey: opsKeys.samples(customerId ?? -1),
    queryFn: () => http.get<SampleOverview>(`/ops/customers/${customerId}/sample-requests`),
    enabled: enabled && customerId !== null,
  });
}

/** Operator writes (contract §12). Callers invalidate `opsKeys.all` (and shell lists when relevant). */
export const opsApi = {
  createCustomer: (body: CustomerCreate) => http.post<OpsCustomer>("/ops/customers", body),
  deactivateCustomer: (id: number, reason: string) =>
    http.post<OpsCustomer>(`/ops/customers/${id}/deactivate`, { reason }),
  reactivateCustomer: (id: number) => http.post<OpsCustomer>(`/ops/customers/${id}/reactivate`),
  createProject: (customerId: number, body: SetupProjectCreate) =>
    http.post<Project>(`/ops/customers/${customerId}/projects`, body),
  invite: (customerId: number, body: OpsInvitation) => http.post<Member>(`/ops/customers/${customerId}/invitations`, body),
  putTemplates: (projectId: number, templates: ProjectTemplate[]) =>
    http.put<Project>(`/ops/projects/${projectId}/templates`, templates),
  putSenders: (projectId: number, senders: string[]) => http.put<Project>(`/ops/projects/${projectId}/senders`, senders),
  setContentTypeActive: (type: ContentType, active: boolean) =>
    http.patch<ContentTypeSetting>(`/ops/content-types/${type}`, { active }),
  createDataset: (body: DatasetCreate) => http.post<Dataset>("/ops/datasets", body),
  uploadDataset: (scope: ContentType, file: File) =>
    uploadFile<Dataset>("/ops/datasets", file, { fields: { scope } }),
  assign: (customerId: number, type: ContentType, datasetId: number) =>
    http.put<DatasetAssignment>(`/ops/customers/${customerId}/dataset-assignments/${type}`, { datasetId }),
  unassign: (customerId: number, type: ContentType) =>
    http.delete<void>(`/ops/customers/${customerId}/dataset-assignments/${type}`),
  confirm: (customerId: number, type: ContentType) =>
    http.post<DatasetAssignment>(`/ops/customers/${customerId}/dataset-assignments/${type}/confirm`),
  createSample: (customerId: number, body: SampleRequestCreate) =>
    http.post<SampleRequest>(`/ops/customers/${customerId}/sample-requests`, body),
  clearSamples: (customerId: number) => http.delete<void>(`/ops/customers/${customerId}/sample-data`),
  sampleReset: () => http.post<SampleResetResult>("/ops/sample-reset"),
  /** Newest outbox mails (used to show the invitation just created). */
  latestMails: (size: number) => http.get<Page<OutboxMail>>("/ops/outbox", { query: { page: 0, size } }),
};
