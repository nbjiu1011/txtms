import { CONTENT_TYPE_LABEL, OFFERED_CONTENT_TYPES, type ContentType } from "@/entities/request/@x/ops";
import type { Dataset, DatasetAssignment, DatasetScope, OpsCustomer } from "./types";

/** Screen label of a dataset scope (`COMMON` 공통 + content type labels). */
export function datasetScopeLabel(scope: DatasetScope): string {
  return scope === "COMMON" ? "공통" : CONTENT_TYPE_LABEL[scope];
}

/** Phase 1 assigns and registers content type datasets only (`COMMON` is Phase 2). */
export const ASSIGNABLE_TYPES: readonly ContentType[] = OFFERED_CONTENT_TYPES;

/** Datasets of one scope, newest version first. */
export function datasetsOf(datasets: Dataset[], scope: DatasetScope): Dataset[] {
  return datasets.filter((d) => d.scope === scope).sort((a, b) => b.version - a.version);
}

/** Newest dataset of a scope (the one a seed connects), or null. */
export function latestDataset(datasets: Dataset[], scope: DatasetScope): Dataset | null {
  return datasetsOf(datasets, scope)[0] ?? null;
}

export function assignmentOf(
  assignments: DatasetAssignment[],
  customerId: number,
  type: DatasetScope,
): DatasetAssignment | null {
  return assignments.find((a) => a.customerId === customerId && a.type === type) ?? null;
}

/** `{유형 라벨들}` of the unassigned active types, joined like the reference (`미배정 문자, RCS`). */
export function unassignedText(customer: Pick<OpsCustomer, "unassignedDatasetTypes">): string {
  return customer.unassignedDatasetTypes.map((t) => CONTENT_TYPE_LABEL[t]).join(", ");
}
