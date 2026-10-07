import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api";
import type { Performance } from "@/entities/dashboard";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { PerformanceView } from "./performance-view";

const empty: Performance = {
  fromDate: "2026-09-08",
  toDate: "2026-10-07",
  projectIds: [1],
  received: 0,
  receivedContents: 0,
  receivedCompleted: 0,
  completionRate: null,
  completedInPeriod: 0,
  completedContents: 0,
  inProgress: 2,
  people: [{ userId: 2, completedAsPrimary: 1, coReviewed: 2, assignmentsManaged: 0, active: 1 }],
  workload: [],
};

const project = (id: number, name: string): Project =>
  ({ id, name, customerId: 1, members: [{ userId: 2, roles: ["REVIEWER"] }] }) as unknown as Project;

afterEach(() => vi.restoreAllMocks());

describe("PerformanceView", () => {
  it("queries the lead's project, shows `–` for an empty cohort and remaps filters", async () => {
    const get = vi.spyOn(http, "get").mockResolvedValue(empty);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(userKeys.byCustomer(1), [
      { id: 2, name: "박지훈", active: true, avatarColor: "#000" } as UserSummary,
    ]);
    const props = {
      active: true,
      me: { id: 3, adminCustomerIds: [], memberships: [{ projectId: 1, customerId: 1, roles: ["REVIEWER"], lead: true }] } as unknown as Me,
      context: {
        customers: [],
        projects: [project(1, "카드 혜택 알림"), project(2, "리스크 고지 문자")],
        customer: null,
        project: null,
        customerId: 1,
        projectId: 1,
        projectsLoading: false,
      },
    } as unknown as WorkViewProps;
    render(
      <QueryClientProvider client={client}>
        <PerformanceView {...props} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("–")).toBeTruthy();
    expect(screen.getByText("% (0/0)")).toBeTruthy();
    expect(screen.getByRole("row", { name: /박지훈 1 2 0 1/ })).toBeTruthy();
    const firstQuery = get.mock.calls[0][1]?.query as Record<string, unknown>;
    expect(firstQuery).toMatchObject({ customerId: 1, projectId: 1 });

    // Only the led project is listed (+ 권한 있는 전체); the user filter goes to the query.
    const projectSelect = screen.getByLabelText("프로젝트") as HTMLSelectElement;
    expect([...projectSelect.options].map((o) => o.textContent)).toEqual(["카드 혜택 알림", "권한 있는 전체"]);
    fireEvent.change(projectSelect, { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("사용자"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("집계 종료일"), { target: { value: "2026-09-30" } });
    await waitFor(() => {
      const last = get.mock.calls.at(-1)?.[1]?.query as Record<string, unknown>;
      expect(last).toMatchObject({ customerId: 1, userId: 2, to: "2026-09-30" });
      expect(last.projectId).toBeUndefined();
    });
  });
});
