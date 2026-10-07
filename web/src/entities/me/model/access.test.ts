import { describe, expect, it } from "vitest";
import { canAccessRoute, roleSummary } from "./access";
import type { Me } from "./types";

function me(overrides: Partial<Me> = {}): Me {
  return {
    id: 1,
    name: "김서연",
    dept: "카드마케팅팀",
    email: "a@b.c",
    customerId: 1,
    operator: false,
    adminCustomerIds: [],
    avatarColor: "var(--avatar-1)",
    demo: false,
    memberships: [],
    session: { remember: false, expiresAt: "" },
    ...overrides,
  };
}

const customer = { id: 1, approvalEnabled: true };

describe("canAccessRoute", () => {
  it("opens 'always' routes to everyone", () => {
    expect(canAccessRoute("always", { me: me(), customer: null, projectId: null })).toBe(true);
  });

  it("review: reviewer or lead in the current project", () => {
    const reviewer = me({ memberships: [{ projectId: 1, customerId: 1, roles: ["REVIEWER"], lead: false }] });
    const lead = me({ memberships: [{ projectId: 1, customerId: 1, roles: [], lead: true }] });
    const requester = me({ memberships: [{ projectId: 1, customerId: 1, roles: ["REQUESTER"], lead: false }] });
    expect(canAccessRoute("reviewer", { me: reviewer, customer, projectId: 1 })).toBe(true);
    expect(canAccessRoute("reviewer", { me: lead, customer, projectId: 1 })).toBe(true);
    expect(canAccessRoute("reviewer", { me: requester, customer, projectId: 1 })).toBe(false);
    expect(canAccessRoute("reviewer", { me: reviewer, customer, projectId: 2 })).toBe(false);
  });

  it("approval: approver and the customer uses the approval stage", () => {
    const approver = me({ memberships: [{ projectId: 1, customerId: 1, roles: ["APPROVER"], lead: false }] });
    expect(canAccessRoute("approver", { me: approver, customer, projectId: 1 })).toBe(true);
    expect(canAccessRoute("approver", { me: approver, customer: { id: 1, approvalEnabled: false }, projectId: 1 })).toBe(
      false,
    );
  });

  it("performance: lead or customer admin; admin menus: customer admin; ops: operator", () => {
    const admin = me({ adminCustomerIds: [1] });
    expect(canAccessRoute("performance", { me: admin, customer, projectId: null })).toBe(true);
    expect(canAccessRoute("admin", { me: admin, customer, projectId: null })).toBe(true);
    expect(canAccessRoute("admin", { me: admin, customer: { id: 2, approvalEnabled: true }, projectId: null })).toBe(false);
    expect(canAccessRoute("ops", { me: admin, customer, projectId: null })).toBe(false);
    expect(canAccessRoute("ops", { me: me({ operator: true }), customer, projectId: null })).toBe(true);
  });
});

describe("roleSummary", () => {
  it("lists project roles, lead, admin and operator in reference order", () => {
    const user = me({
      adminCustomerIds: [1],
      operator: true,
      memberships: [{ projectId: 1, customerId: 1, roles: ["REVIEWER"], lead: true }],
    });
    expect(roleSummary(user, 1, 1)).toBe("검수자, 대표 검수자, 고객사 관리자, 솔루션 운영 담당자");
  });

  it("falls back to 역할 없음", () => {
    expect(roleSummary(me(), 1, 1)).toBe("역할 없음");
  });
});
