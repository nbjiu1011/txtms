/** Solution operator resources — contract §0.5, §12. */
import type { Customer } from "@/entities/customer/@x/ops";
import type { ContentType } from "@/entities/request/@x/ops";

export type DatasetScope = "COMMON" | ContentType;

export interface OpsCustomer extends Customer {
  projectCount: number;
  userCount: number;
  activeRequestCount: number;
  adminAssigned: boolean;
  unassignedDatasetTypes: ContentType[];
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

export interface DatasetAssignment {
  customerId: number;
  type: ContentType;
  datasetId: number;
  assignedAt: string;
  assignedBy: number;
  checkedAt: string | null;
  checkedBy: number | null;
}
