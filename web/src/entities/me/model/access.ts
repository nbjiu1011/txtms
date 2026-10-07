import type { RouteAccess } from "@/shared/config/routes";
import { LEAD_ROLE_LABEL, PROJECT_ROLE_LABEL, type ProjectRole } from "@/entities/project/@x/me";
import type { Me } from "./types";

/** Current customer/project context used for menu visibility (UX only — the server re-checks). */
export interface AccessContext {
  me: Me;
  customer: { id: number; approvalEnabled: boolean } | null;
  projectId: number | null;
}

export type DerivedRole = ProjectRole | "LEAD";

/** Roles of `me` in a project, lead appended last (same order as the reference). */
export function projectRoles(me: Me, projectId: number | null): DerivedRole[] {
  if (projectId === null) return [];
  const membership = me.memberships.find((m) => m.projectId === projectId);
  if (!membership) return [];
  const roles: DerivedRole[] = [...membership.roles];
  if (membership.lead) roles.push("LEAD");
  return roles;
}

export function isCustomerAdmin(me: Me, customerId: number | null): boolean {
  return customerId !== null && me.adminCustomerIds.includes(customerId);
}

export function canAccessRoute(access: RouteAccess, ctx: AccessContext): boolean {
  const roles = projectRoles(ctx.me, ctx.projectId);
  const customerId = ctx.customer?.id ?? null;
  switch (access) {
    case "always":
      return true;
    case "reviewer":
      return roles.includes("REVIEWER") || roles.includes("LEAD");
    case "approver":
      return !!ctx.customer?.approvalEnabled && roles.includes("APPROVER");
    case "performance":
      return roles.includes("LEAD") || isCustomerAdmin(ctx.me, customerId);
    case "admin":
      return isCustomerAdmin(ctx.me, customerId);
    case "ops":
      return ctx.me.operator;
  }
}

export const CUSTOMER_ADMIN_LABEL = "고객사 관리자";
export const OPERATOR_LABEL = "솔루션 운영 담당자";
export const NO_ROLE_LABEL = "역할 없음";

/** Role text of the user button: project roles, then 고객사 관리자 / 솔루션 운영 담당자. */
export function roleSummary(me: Me, customerId: number | null, projectId: number | null): string {
  const labels: string[] = projectRoles(me, projectId).map((role) =>
    role === "LEAD" ? LEAD_ROLE_LABEL : PROJECT_ROLE_LABEL[role],
  );
  if (isCustomerAdmin(me, customerId)) labels.push(CUSTOMER_ADMIN_LABEL);
  if (me.operator) labels.push(OPERATOR_LABEL);
  return labels.join(", ") || NO_ROLE_LABEL;
}
