import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { http, uploadFile, type Page } from "@/shared/api";
import type { AuditLog, OutboxMail } from "@/entities/audit/@x/ops";
import type { Project, ProjectTemplate } from "@/entities/project/@x/ops";
import type { ContentType, ContentTypeSetting } from "@/entities/request/@x/ops";
import type { Customer } from "@/entities/customer/@x/ops";
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
  OpsInvited,
  SampleOverview,
  SampleRequest,
  SampleRequestCreate,
  SampleResetResult,
  SetupContext,
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
  customers: (page: number, size: number) => ["ops", "customers", "list", { page, size }] as const,
  customer: (id: number) => ["ops", "customers", "detail", id] as const,
  customerOptions: () => ["ops", "customer-options", "list", {}] as const,
  contentTypes: () => ["ops", "content-types", "list", {}] as const,
  datasets: () => ["ops", "datasets", "list", {}] as const,
  dataset: (id: number) => ["ops", "datasets", "detail", id] as const,
  assignments: () => ["ops", "dataset-assignments", "list", {}] as const,
  setupLogs: (customerId: number, page: number, size: number) =>
    ["ops", "setup-logs", "list", { customerId, page, size }] as const,
  auditLogs: (params: OpsAuditParams) => ["ops", "audit-logs", "list", params] as const,
  outbox: (customerId: number | null, page: number, size: number) =>
    ["ops", "outbox", "list", { customerId, page, size }] as const,
  members: (customerId: number, page: number, size: number) =>
    ["ops", "members", "list", { customerId, page, size }] as const,
  projects: (customerId: number, page: number, size: number) =>
    ["ops", "projects", "list", { customerId, page, size }] as const,
  setupContext: (customerId: number) => ["ops", "setup-context", "detail", customerId] as const,
  samples: (customerId: number) => ["ops", "sample-requests", "list", { customerId }] as const,
};

/** 운영 대시보드 (`GET /api/ops/dashboard`). */
export function useOpsDashboard(enabled = true) {
  return useQuery({ queryKey: opsKeys.dashboard(), queryFn: () => http.get<OpsDashboard>("/ops/dashboard"), enabled });
}

/** 고객사 관리 list: one page of customers with operator counts, inactive ones included (id order). */
export function useOpsCustomers(page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.customers(page, size),
    queryFn: () => http.get<Page<OpsCustomer>>("/ops/customers", { query: { page, size } }),
    placeholderData: keepPreviousData,
  });
}

/** One customer with operator counts (detail page), active or not. */
export function useOpsCustomer(id: number | null) {
  return useQuery({
    queryKey: opsKeys.customer(id ?? -1),
    queryFn: () => http.get<OpsCustomer>(`/ops/customers/${id}`),
    enabled: id !== null,
  });
}

/** Reference list for customer selects: every customer, inactive ones included (id order, max 500). */
export function useOpsCustomerOptions() {
  return useQuery({
    queryKey: opsKeys.customerOptions(),
    queryFn: () => http.get<Customer[]>("/ops/customers/options"),
  });
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

/** 설정 이력 of a customer, newest first, one page. */
export function useSetupLogs(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.setupLogs(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<SetupLog>>("/ops/setup-logs", { query: { customerId, page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
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

/**
 * Queued mails of one customer's users (`customerId`) or of everyone (null), newest first; token links
 * are masked outside demo mode.
 */
export function useOpsOutbox(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.outbox(customerId, page, size),
    queryFn: () => http.get<Page<OutboxMail>>("/ops/outbox", { query: { customerId, page, size } }),
    placeholderData: keepPreviousData,
  });
}

/** One page of a customer's members, pending invitations and inactive customers included (contract §14.7). */
export function useOpsCustomerMembers(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.members(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<Member>>(`/ops/customers/${customerId}/members`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** One page of a customer's projects, stopped ones and inactive customers included (contract §14.7). */
export function useOpsCustomerProjects(customerId: number | null, page: number, size: number) {
  return useQuery({
    queryKey: opsKeys.projects(customerId ?? -1, page, size),
    queryFn: () => http.get<Page<Project>>(`/ops/customers/${customerId}/projects`, { query: { page, size } }),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

/** Every project and member of a customer for the initial setup screen (selects, step checks). */
export function useOpsSetupContext(customerId: number | null) {
  return useQuery({
    queryKey: opsKeys.setupContext(customerId ?? -1),
    queryFn: () => http.get<SetupContext>(`/ops/customers/${customerId}/setup-context`),
    enabled: customerId !== null,
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
  invite: (customerId: number, body: OpsInvitation) =>
    http.post<OpsInvited>(`/ops/customers/${customerId}/invitations`, body),
  putTemplates: (projectId: number, templates: ProjectTemplate[]) =>
    http.put<Project>(`/ops/projects/${projectId}/templates`, templates),
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
  /** Newest mails of a customer's users (used to find the invitation just created by its `mailId`). */
  latestMails: (customerId: number, size: number) =>
    http.get<Page<OutboxMail>>("/ops/outbox", { query: { customerId, page: 0, size } }),
};
