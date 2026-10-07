import { describe, expect, it } from "vitest";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { contextProjects } from "./use-work-context";

const project = (id: number, customerId = 1) => ({ id, customerId, name: `P${id}` }) as Project;
const me = (patch: Partial<Me>) => ({ id: 5, operator: false, adminCustomerIds: [], memberships: [], ...patch }) as Me;

describe("top bar projects (reference myProjects)", () => {
  it("gives an operator without membership no project context", () => {
    expect(contextProjects(me({ operator: true }), [project(1), project(2)])).toEqual([]);
  });

  it("keeps the projects an operator is a member or admin of", () => {
    const operator = me({
      operator: true,
      adminCustomerIds: [2],
      memberships: [{ projectId: 1, customerId: 1, roles: ["REQUESTER"], lead: false }],
    });
    expect(contextProjects(operator, [project(1), project(3), project(4, 2)])?.map((p) => p.id)).toEqual([1, 4]);
  });

  it("leaves the server's list as is for other users", () => {
    const list = [project(1), project(2)];
    expect(contextProjects(me({}), list)).toBe(list);
    expect(contextProjects(me({ operator: true }), undefined)).toBeUndefined();
  });
});
