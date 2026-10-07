import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT, dashboardU1, dashboardU11, dashboardU3, request102U1, requestListU1 } from "@fixtures/api-snapshot";
import { formatKstToday, useViewIntent } from "@/shared/lib";
import type { Customer } from "@/entities/customer";
import { dashboardKeys, type Dashboard } from "@/entities/dashboard";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { requestApi, requestKeys, viewListParams } from "@/entities/request";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { DashboardView } from "./dashboard-view";

function setup(userId: number, dashboard: Dashboard) {
  const snap = API_SNAPSHOT[userId];
  const me = snap["/me"] as Me;
  const customers = snap["/customers"] as Customer[];
  const projects = snap["/customers/1/projects"] as Project[];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(dashboardKeys.project(1), dashboard);
  client.setQueryData(userKeys.byCustomer(1), snap["/customers/1/users"] as UserSummary[]);
  const openTab = vi.fn();
  const props: WorkViewProps = {
    tab: { id: "t1", route: "home", params: {}, dirty: false, title: null },
    active: true,
    me,
    context: {
      customers,
      projects,
      customer: customers[0],
      project: projects.find((p) => p.id === 1) ?? null,
      customerId: 1,
      projectId: 1,
      projectsLoading: false,
    },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab,
  };
  render(
    <QueryClientProvider client={client}>
      <DashboardView {...props} />
    </QueryClientProvider>,
  );
  return { client, openTab };
}

describe("DashboardView", () => {
  it("renders the requester dashboard from the API fixture", () => {
    const { openTab } = setup(1, dashboardU1);
    expect(screen.getByText(formatKstToday())).toBeTruthy();
    expect(screen.getByRole("heading", { name: "김서연님, 오늘 처리할 업무입니다" })).toBeTruthy();
    expect(screen.getByText("카드 혜택 알림 프로젝트 기준입니다.")).toBeTruthy();

    // KPI tiles in contract order with counts.
    const kpis = dashboardU1.kpis.map((k) => screen.getByRole("button", { name: `${k.label} ${k.count}건` }));
    expect(kpis).toHaveLength(3);

    // Pipeline total and stages.
    const pipe = screen.getByRole("region", { name: "프로젝트 요청 흐름" });
    expect(within(pipe).getByText(`${dashboardU1.pipelineTotal}건`)).toBeTruthy();
    expect(within(pipe).getAllByRole("button")).toHaveLength(dashboardU1.pipeline.length);

    // 지금 처리할 일: count note, labels, due tag; a row opens the request tab.
    expect(screen.getByText(`${dashboardU1.todos.length}건`)).toBeTruthy();
    const answer = screen.getByRole("button", { name: /확인 요청에 답변/ });
    expect(within(answer).getByText("납기 임박")).toBeTruthy();
    fireEvent.click(answer);
    expect(openTab).toHaveBeenCalledWith({ route: "request", params: { id: "REQ-2609-102" } });

    // Recent requests show the requester name; notices list the project scope.
    expect(screen.getAllByText(/REQ-2609-105 알림톡 김서연/).length).toBeGreaterThan(0);
    expect(screen.getByText(/프로젝트 공지 카드 혜택 알림/)).toBeTruthy();
    // Not a lead: no workload panel. Requester: 새 요청 button.
    expect(screen.queryByText("검수자별 업무량")).toBeNull();
    expect(screen.getByRole("button", { name: /새 요청/ })).toBeTruthy();
  });

  it("creates a draft with 새 요청 and opens its tab", async () => {
    const created = { ...request102U1, id: "REQ-2610-121", status: "DRAFT" as const, title: "" };
    const create = vi.spyOn(requestApi, "create").mockResolvedValue(created);
    const { openTab, client } = setup(1, dashboardU1);
    fireEvent.click(screen.getByRole("button", { name: /새 요청/ }));
    await waitFor(() => expect(openTab).toHaveBeenCalledWith({ route: "request", params: { id: "REQ-2610-121" } }));
    expect(create).toHaveBeenCalledWith({ projectId: 1 });
    expect(client.getQueryData(requestKeys.detail("REQ-2610-121"))).toEqual(created);
    create.mockRestore();
  });

  it("opens the KPI list modal with the same server view", () => {
    const { client, openTab } = setup(1, dashboardU1);
    client.setQueryData(requestKeys.list(viewListParams("MY_IN_PROGRESS", { projectId: 1, customerId: 1 })), {
      ...requestListU1,
      content: requestListU1.content.filter((r) => ["WAITING", "IN_REVIEW", "APPROVAL_WAITING"].includes(r.status)),
    });
    fireEvent.click(screen.getByRole("button", { name: "진행 중 5건" }));
    const dialog = screen.getByRole("dialog", { name: "진행 중" });
    fireEvent.click(within(dialog).getByRole("button", { name: /회원 약관 개정 고지문/ }));
    expect(openTab).toHaveBeenCalledWith({ route: "request", params: { id: "REQ-2609-107" } });
  });

  it("shows the lead's KPIs and workload", () => {
    setup(3, dashboardU3);
    for (const label of ["내 검수", "회수 처리 필요", "배정 대기", "지연", "납기 임박"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label} \\d+건$`) })).toBeTruthy();
    }
    expect(screen.getByText("검수자별 업무량")).toBeTruthy();
    expect(screen.getAllByRole("meter")).toHaveLength(dashboardU3.workload.length);
  });

  it("shows the customer admin banner and the empty todo state", () => {
    setup(11, dashboardU11);
    expect(screen.getByText("고객사 관리자 권한으로 보고 있습니다")).toBeTruthy();
    expect(screen.getByText("처리할 일이 없습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "고객사 진행 중 7건" })).toBeTruthy();
  });

  it("opens 접근·변경 기록 from the admin banner and a notice row expanded on 공지", () => {
    const { openTab } = setup(11, dashboardU11);
    fireEvent.click(screen.getByRole("button", { name: "접근 기록 보기" }));
    expect(useViewIntent.getState().intents.adminUsers).toBe("audit");
    expect(openTab).toHaveBeenLastCalledWith({ route: "adminUsers", params: {} });
    const notice = dashboardU11.notices[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(notice.title) }));
    expect(useViewIntent.getState().intents.notices).toBe(String(notice.id));
    expect(openTab).toHaveBeenLastCalledWith({ route: "notices", params: {} });
  });
});
