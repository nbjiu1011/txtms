import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api";
import type { Me } from "@/entities/me";
import { opsApi, opsKeys, type OpsCustomer } from "@/entities/ops";
import type { Project } from "@/entities/project";
import type { Member } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { OpsCustomerDetailView } from "./customer-detail-view";
import { OpsCustomersView } from "./ops-customers-view";

const customer = (id: number, name: string, patch: Partial<OpsCustomer> = {}): OpsCustomer => ({
  id,
  name,
  domain: `c${id}.com`,
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
  requestCount: 4,
  activeRequestCount: 1,
  completedRequestCount: 2,
  sampleRequestCount: 0,
  admins: [],
  adminAssigned: false,
  unassignedDatasetTypes: [],
  ...patch,
});

const project = (id: number, patch: Partial<Project> = {}): Project => ({
  id,
  customerId: 3,
  name: `프로젝트 ${id}`,
  active: true,
  leadUserId: 31,
  templates: [{ code: "T1", name: "템플릿" }],
  members: [{ userId: 31, roles: ["REVIEWER"] }],
  variablesRevision: 1,
  ...patch,
});

const member = (id: number, name: string, patch: Partial<Member> = {}): Member => ({
  user: { id, name, dept: "운영팀", email: `u${id}@c3.com`, active: true, avatarColor: "#000" },
  pending: false,
  admin: false,
  projects: [],
  invitationExpiresAt: null,
  pendingEmail: null,
  ...patch,
});

/** Contract page of the given rows (`page` of `totalPages`). */
function pageOf<T>(rows: T[], page = 0, totalPages = 1, totalElements = rows.length) {
  return { content: rows, page: { number: page, size: 20, totalElements, totalPages } };
}

function props(route: WorkViewProps["tab"]["route"], params: WorkViewProps["tab"]["params"] = {}): WorkViewProps {
  return {
    tab: { id: "t1", route, params, dirty: false, title: null },
    active: true,
    me: { id: 5, name: "정우진", operator: true } as Me,
    context: { customers: [], projects: [], customer: null, project: null, customerId: null, projectId: null, projectsLoading: false },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab: vi.fn(),
  };
}

function renderWith(client: QueryClient, ui: React.ReactElement) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("고객사 관리 list", () => {
  it("shows one server page, opens the detail tab from a row or its name and asks the server for the next page", async () => {
    const client = newClient();
    const first = Array.from({ length: 20 }, (_, i) => customer(i + 1, `고객사${i + 1}`, { active: i !== 4 }));
    client.setQueryData(opsKeys.customers(0, 20), pageOf(first, 0, 2, 21));
    client.setQueryData(opsKeys.customerOptions(), first);
    const get = vi.spyOn(http, "get").mockResolvedValue(pageOf([customer(21, "마지막고객사")], 1, 2, 21));
    const p = props("opsCustomers");
    renderWith(client, <OpsCustomersView {...p} />);

    expect(screen.getAllByRole("button", { name: /열기$/ })).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "고객사3 열기" }));
    expect(p.openTab).toHaveBeenCalledWith({ route: "opsCustomer", params: { id: "3" } });
    // a click on another cell of the row opens it too
    const row = screen.getByRole("button", { name: "고객사7 열기" }).closest<HTMLElement>('[role="row"]')!;
    fireEvent.click(within(row).getAllByRole("cell")[1]);
    expect(p.openTab).toHaveBeenCalledWith({ route: "opsCustomer", params: { id: "7" } });
    // status actions live on the detail page only
    expect(screen.queryByRole("button", { name: /^(상세|비활성|비활성화|사용 재개)$/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("마지막고객사")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/ops/customers", { query: { page: 1, size: 20 } });
    // the first pager is the customer list (the 운영 이력 below has its own)
    expect(screen.getAllByRole("button", { name: "2 페이지" })[0].getAttribute("aria-current")).toBe("page");
  });
});

describe("고객사 상세", () => {
  function setupDetail(c: OpsCustomer) {
    const client = newClient();
    client.setQueryData(opsKeys.customer(c.id), c);
    client.setQueryData(opsKeys.setupContext(c.id), {
      projects: [project(7, { name: "고객 안내 알림톡" })],
      members: [member(31, "한봄")],
    });
    client.setQueryData(opsKeys.projects(c.id, 0, 20), pageOf([project(7, { name: "고객 안내 알림톡" })]));
    client.setQueryData(
      opsKeys.members(c.id, 0, 20),
      pageOf([
        member(31, "한봄", { admin: true, projects: [{ projectId: 7, roles: ["REVIEWER"], lead: true }] }),
        member(32, "초대자", { pending: true, invitationExpiresAt: "2026-10-14T05:00:00Z" }),
      ]),
    );
    client.setQueryData(opsKeys.auditLogs({ customerId: c.id, page: 0, size: 20 }), pageOf([]));
    const p = props("opsCustomer", { id: String(c.id) });
    renderWith(client, <OpsCustomerDetailView {...p} />);
    return p;
  }

  it("shows the summary, the paged projects and users with names, and names the tab", async () => {
    const p = setupDetail(customer(3, "새봄은행", { unassignedDatasetTypes: ["SMS"] }));
    expect(screen.getByRole("heading", { name: "새봄은행" })).toBeTruthy();
    await waitFor(() => expect(p.setTitle).toHaveBeenCalledWith("새봄은행"));
    expect(screen.getByText("전체 4건, 진행 중 1건, 완료 2건")).toBeTruthy();
    expect(screen.getByText("미배정 문자")).toBeTruthy();

    expect(screen.getByText("고객 안내 알림톡")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "발신번호" })).toBeNull();
    expect(screen.getByText("고객 안내 알림톡: 검수자, 대표 검수자")).toBeTruthy();
    expect(screen.getByText("초대 대기")).toBeTruthy();
    expect(screen.getAllByText("한봄").length).toBeGreaterThan(0);
  });

  it("opens 초기 설정 and goes back to the list", () => {
    const p = setupDetail(customer(3, "새봄은행"));
    fireEvent.click(screen.getByRole("button", { name: "초기 설정 열기" }));
    expect(p.openTab).toHaveBeenCalledWith({ route: "opsSetup", params: {} });
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    expect(p.openTab).toHaveBeenCalledWith({ route: "opsCustomers", params: {} });
  });

  it("asks before 비활성화 with a question naming the customer and a warn OK", () => {
    setupDetail(customer(3, "새봄은행"));
    expect(screen.queryByRole("button", { name: "사용 재개" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    const d = screen.getByRole("dialog", { name: "고객사 「새봄은행」를 비활성화할까요?" });
    expect(within(d).getByLabelText(/비활성 사유/)).toBeTruthy();
    expect(within(d).getByRole("button", { name: "비활성화" }).className).toContain("text-danger");
  });

  it("offers 사용 재개 for an inactive customer and runs it at once", async () => {
    const reactivate = vi.spyOn(opsApi, "reactivateCustomer").mockResolvedValue(customer(3, "새봄은행"));
    // the refresh after the write stays pending (no network in tests)
    vi.spyOn(http, "get").mockReturnValue(new Promise(() => {}));
    setupDetail(customer(3, "새봄은행", { active: false, deactivationReason: "계약 종료" }));
    expect(screen.queryByRole("button", { name: "비활성화" })).toBeNull();
    expect(screen.getByText(/계약 종료/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "사용 재개" }));
    await waitFor(() => expect(reactivate).toHaveBeenCalledWith(3));
  });

  it("reports a missing customer", () => {
    const client = newClient();
    renderWith(client, <OpsCustomerDetailView {...props("opsCustomer", { id: "abc" })} />);
    expect(screen.getByText("고객사를 찾을 수 없습니다")).toBeTruthy();
  });
});
