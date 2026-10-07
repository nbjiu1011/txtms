/** Solution operator resources — contract §9 (OpsDashboard), §12. */
import type { AuditLog } from "@/entities/audit/@x/ops";
import type { Customer } from "@/entities/customer/@x/ops";
import type { ProjectRole, ProjectTemplate } from "@/entities/project/@x/ops";
import type { ContentType, RequestStatus } from "@/entities/request/@x/ops";
import type { UserSummary } from "@/entities/user/@x/ops";

export type DatasetScope = "COMMON" | ContentType;

/** Customer with operator counts (numbers only — operators never see request contents). */
export interface OpsCustomer extends Customer {
  createdBy: number | null;
  deactivationReason: string | null;
  projectCount: number;
  /** Includes pending invitations and inactive users. */
  userCount: number;
  /** Every request (drafts and cancelled included). */
  requestCount: number;
  /** `WAITING`…`APPROVAL_WAITING`. */
  activeRequestCount: number;
  completedRequestCount: number;
  sampleRequestCount: number;
  /** Usable (active, accepted) customer admins. */
  admins: UserSummary[];
  adminAssigned: boolean;
  /** Active content types without an effective dataset (enum order). */
  unassignedDatasetTypes: ContentType[];
}

export interface OpsKpis {
  activeCustomers: number;
  customersWithoutAdmin: number;
  customersWithUnassignedDatasets: number;
}

export const OPS_TODO_KINDS = ["INVITE_ADMIN", "CREATE_PROJECT", "ASSIGN_DATASETS"] as const;
export type OpsTodoKind = (typeof OPS_TODO_KINDS)[number];

/** One remaining initial setup step (초기 설정에서 남은 일). */
export interface OpsTodo {
  kind: OpsTodoKind;
  label: string;
  /** Web route key (`opsSetup` / `opsStandards`). */
  route: string;
  /** Sub tab of the route (`assign`) or null. */
  sub: string | null;
  customerId: number;
  customerName: string;
  customerDomain: string;
  approvalEnabled: boolean;
  count: number | null;
}

export interface OpsDashboard {
  kpis: OpsKpis;
  todos: OpsTodo[];
  customers: OpsCustomer[];
  recentAudit: AuditLog[];
}

export interface Dataset {
  id: number;
  scope: DatasetScope;
  version: number;
  ruleCount: number;
  createdAt: string;
  createdBy: number;
}

export interface DatasetRule {
  ruleId: string;
  originalExpr: string;
  recommendedExpr: string;
  originalPattern: string;
  recommendedPattern: string;
  descriptionLabel: string;
  description: string;
}

export interface DatasetDetail extends Dataset {
  rules: DatasetRule[];
}

/** `POST /api/ops/datasets` JSON body (the XLSX form sends `scope` + `file`). */
export interface DatasetCreate {
  scope: ContentType;
  rules: Partial<DatasetRule>[];
}

export interface DatasetAssignment {
  customerId: number;
  /** `DatasetScope` string (Phase 1 assigns content types only). */
  type: DatasetScope;
  datasetId: number;
  assignedAt: string;
  assignedBy: number;
  checkedAt: string | null;
  checkedBy: number | null;
}

export interface SetupLog {
  id: number;
  customerId: number;
  at: string;
  actorId: number | null;
  actorName: string | null;
  action: string;
  target: string;
  result: string;
}

/** Subset of RequestSummary (same keys) — operators see sample requests only. */
export interface SampleRequest {
  id: string;
  projectId: number;
  type: ContentType;
  title: string;
  status: RequestStatus;
  createdAt: string;
}

export interface SampleOverview {
  customerId: number;
  sample: boolean;
  samples: SampleRequest[];
  /** Real requests the sample cleanup never deletes. */
  realRequestCount: number;
}

export interface SampleResetResult {
  customerIds: number[];
  deletedRequests: number;
  restoredRequests: number;
}

export interface CustomerCreate {
  name: string;
  domain: string;
  approvalEnabled: boolean;
}

export interface SetupProjectCreate {
  name: string;
  leadUserId: number | null;
}

/** `POST /api/ops/customers/{id}/invitations` body. */
export interface OpsInvitation {
  email: string;
  name: string;
  dept: string;
  /** Grants the customer admin right (first admin). */
  admin: boolean;
  projectId: number | null;
  role: ProjectRole | null;
  externalDomainConfirmed: boolean;
}

export type TemplatesPut = ProjectTemplate[];

export interface SampleRequestCreate {
  projectId: number;
  type: ContentType;
}

export interface OpsAuditParams {
  customerId: number | null;
  page: number;
  size: number;
}
