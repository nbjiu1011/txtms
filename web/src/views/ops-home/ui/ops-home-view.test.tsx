import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewIntent } from "@/shared/lib";
import type { Me } from "@/entities/me";
import { opsKeys, type OpsCustomer, type OpsDashboard } from "@/entities/ops";
import { decodeOpsIntent } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { OpsHomeView } from "./ops-home-view";

const customer = (id: number, name: string, patch: Partial<OpsCustomer> = {}): OpsCustomer => ({
  id,
  name,
  domain: `${name}.com`,
  approvalEnabled: false,
  active: true,
  sample: false,
  notifyChannel: "IN_APP",
  dueSoonDays: 3,
  createdAt: "2026-10-01T01:00:00Z",
  createdBy: 5,
  createdByName: "정우진",
  deactivationReason: null,
  projectCount: 1,
  userCount: 2,
  requestCount: 3,
  activeRequestCount: 1,
  completedRequestCount: 1,
  sampleRequestCount: 0,
  admins: [],
  adminAssigned: false,
  unassignedDatasetTypes: [],
  ...patch,
});

const data: OpsDashboard = {
  kpis: { activeCustomers: 2, customersWithoutAdmin: 1, customersWithUnassignedDatasets: 1 },
  todos: [
    {
      kind: "INVITE_ADMIN",
      label: "고객사 관리자 초대",
      route: "opsSetup",
      sub: null,
      customerId: 3,
      customerName: "새봄은행",
      customerDomain: "saebom.co.kr",
      approvalEnabled: true,
      count: null,
    },
    {
      kind: "ASSIGN_DATASETS",
      label: "유효 데이터셋 2개 조합 배정",
      route: "opsStandards",
      sub: "assign",
      customerId: 2,
      customerName: "도담생명",
      customerDomain: "dodamlife.com",
      approvalEnabled: false,
      count: 2,
    },
  ],
  customers: [
    customer(2, "도담생명", { unassignedDatasetTypes: ["SMS", "FREEFORM"] }),
    customer(3, "새봄은행", { active: false }),
  ],
  recentAudit: [
    { id: 1, at: "2026-10-07T05:00:00Z", actorId: 5, actorName: "정우진", action: "고객사 생성", customerId: 3, target: "새봄은행", detail: "saebom.co.kr, 승인 단계 사용" },
  ],
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(opsKeys.dashboard(), data);
  const openTab = vi.fn();
  const props: WorkViewProps = {
    tab: { id: "t1", route: "home", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 5, name: "정우진", operator: true } as Me,
    context: {
      customers: [],
      projects: [],
      customer: null,
      project: null,
      customerId: 1,
      projectId: null,
      projectsLoading: false,
    },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab,
  };
  render(
    <QueryClientProvider client={client}>
      <OpsHomeView {...props} />
    </QueryClientProvider>,
  );
  return { openTab };
}

const intentOf = (view: string) => decodeOpsIntent(useViewIntent.getState().intents[view]);

afterEach(() => {
  useViewIntent.setState({ intents: {} });
});

describe("OpsHomeView", () => {
  it("shows the three KPIs (no 내 지원 접근) and the remaining setup steps", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "정우진님, 운영 현황입니다" })).toBeTruthy();
    expect(screen.getByText("등록 고객사")).toBeTruthy();
    expect(screen.getByText("관리자 미지정")).toBeTruthy();
    expect(screen.getByText("데이터셋 미배정 고객사")).toBeTruthy();
    expect(screen.queryByText("내 지원 접근")).toBeNull();
    expect(screen.getByText("2건")).toBeTruthy();
    expect(screen.getByText("새봄은행 (비활성)")).toBeTruthy();
    expect(screen.getByText("미배정 2")).toBeTruthy();
    expect(screen.getByText("새봄은행 10/7 14:00 정우진")).toBeTruthy();
  });

  it("opens 초기 설정·시드 on the todo's customer", () => {
    const { openTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: /고객사 관리자 초대.*새봄은행/ }));
    expect(openTab).toHaveBeenCalledWith({ route: "opsSetup", params: {} });
    expect(intentOf("opsSetup")).toEqual({ customerId: 3 });
  });

  it("opens 유효 데이터셋 배정 for a dataset todo", () => {
    const { openTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: /유효 데이터셋 2개 조합 배정.*도담생명/ }));
    expect(openTab).toHaveBeenCalledWith({ route: "opsStandards", params: {} });
    expect(intentOf("opsStandards")).toEqual({ customerId: 2, sub: "assign" });
  });

  it("opens the detail page of the clicked customer", () => {
    const { openTab } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^도담생명프로젝트/ }));
    expect(openTab).toHaveBeenCalledWith({ route: "opsCustomer", params: { id: "2" } });
  });
});
