import { CUSTOMER_ADMIN_LABEL, OPERATOR_LABEL, type Me } from "@/entities/me";
import { PROJECT_ROLE_LABEL, PROJECT_ROLES } from "@/entities/project";

/** One project of the user with its role labels (read-only on the profile page). */
export interface ProfileRoleRow {
  projectId: number;
  projectName: string;
  /** Customer name, given only when the memberships span several customers. */
  customerName: string | null;
  /** Project roles in contract order (요청자 · 검수자 · 승인자). */
  roles: string[];
  /** 대표 검수자 of the project. */
  lead: boolean;
}

/**
 * Memberships of `me` as display rows, in membership order. Names come from the loaded project/customer lists;
 * a project not loaded yet shows as "프로젝트 {id}".
 */
export function profileRoleRows(
  me: Me,
  projectNames: ReadonlyMap<number, string>,
  customerNames: ReadonlyMap<number, string>,
): ProfileRoleRow[] {
  const severalCustomers = new Set(me.memberships.map((m) => m.customerId)).size > 1;
  return me.memberships.map((m) => ({
    projectId: m.projectId,
    projectName: projectNames.get(m.projectId) ?? `프로젝트 ${m.projectId}`,
    customerName: severalCustomers ? (customerNames.get(m.customerId) ?? null) : null,
    roles: PROJECT_ROLES.filter((role) => m.roles.includes(role)).map((role) => PROJECT_ROLE_LABEL[role]),
    lead: m.lead,
  }));
}

/** Account-level roles: 고객사 관리자 (per administered customer) and 솔루션 운영 담당자. */
export function accountRoleLabels(me: Me, customerNames: ReadonlyMap<number, string>): string[] {
  const labels = me.adminCustomerIds.map((id) => {
    const name = customerNames.get(id);
    return name && (me.adminCustomerIds.length > 1 || id !== me.customerId)
      ? `${CUSTOMER_ADMIN_LABEL} (${name})`
      : CUSTOMER_ADMIN_LABEL;
  });
  if (me.operator) labels.push(OPERATOR_LABEL);
  return labels;
}
