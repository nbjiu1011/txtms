import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewIntent } from "@/shared/lib";
import type { Me } from "@/entities/me";
import { opsKeys, type OpsCustomer, type SampleOverview } from "@/entities/ops";
import type { Project } from "@/entities/project";
import type { Member } from "@/entities/user";
import { decodeOpsIntent, requestOpsIntent } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { memberCounts, setupSteps } from "../model/setup-steps";
import { OpsSetupView } from "./ops-setup-view";

const customer = (id: number, name: string, patch: Partial<OpsCustomer> = {}): OpsCustomer => ({
  id,
  name,
  domain: `c${id}.com`,
  approvalEnabled: true,
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
  requestCount: 0,
  activeRequestCount: 0,
  completedRequestCount: 0,
  sampleRequestCount: 0,
  admins: [],
  adminAssigned: false,
  unassignedDatasetTypes: [],
  ...patch,
});

const project = (id: number, customerId: number, patch: Partial<Project> = {}): Project => ({
  id,
  customerId,
  name: `프로젝트 ${id}`,
  active: true,
  leadUserId: null,
  templates: [],
  senders: [],
  members: [],
  variablesRevision: 0,
  ...patch,
});

const sampleCustomer = customer(1, "한빛카드", {
  sample: true,
  adminAssigned: true,
  admins: [{ id: 11, name: "강민호", dept: "경영지원팀", email: "minho@c1.com", active: true, avatarColor: "#000" }],
});
const pendingAdmin: Member = {
  user: { id: 31, name: "한봄", dept: null, email: "admin@c3.com", active: false, avatarColor: "#000" },
  pending: true,
  admin: true,
  projects: [],
  invitationExpiresAt: "2026-10-14T05:00:00Z",
};
const realCustomer = customer(3, "새봄은행", { approvalEnabled: false, unassignedDatasetTypes: ["SMS", "RCS"] });

/** Contract page of fixture rows (single page). */
function pageOf<T>(rows: T[], size = 20) {
  return { content: rows, page: { number: 0, size, totalElements: rows.length, totalPages: rows.length ? 1 : 0 } };
}

function setup(customerId: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(opsKeys.customerOptions(), [sampleCustomer, realCustomer]);
  client.setQueryData(opsKeys.customer(1), sampleCustomer);
  client.setQueryData(opsKeys.customer(3), realCustomer);
  const projects1 = [
    project(1, 1, {
      name: "카드 혜택 알림",
      templates: [{ code: "HB_POINT_01", name: "포인트" }],
      senders: ["1588-0000"],
      members: [
        { userId: 1, roles: ["REQUESTER"] },
        { userId: 3, roles: ["REVIEWER"] },
      ],
    }),
  ];
  client.setQueryData(opsKeys.setupContext(1), { projects: projects1, members: [] });
  client.setQueryData(opsKeys.setupContext(3), { projects: [project(7, 3, { name: "기본 프로젝트" })], members: [pendingAdmin] });
  client.setQueryData(opsKeys.datasets(), []);
  client.setQueryData(opsKeys.assignments(), []);
  client.setQueryData(opsKeys.contentTypes(), []);
  client.setQueryData(opsKeys.setupLogs(1, 0, 20), pageOf([]));
  client.setQueryData(
    opsKeys.setupLogs(3, 0, 20),
    pageOf([
      { id: 1, customerId: 3, at: "2026-10-07T05:00:00Z", actorId: 5, actorName: "정우진", action: "기본 프로젝트 생성", target: "기본 프로젝트", result: "첫 고객사 관리자 초대 필요" },
    ]),
  );
  client.setQueryData(opsKeys.outbox(1, 0, 20), pageOf([]));
  client.setQueryData(opsKeys.outbox(3, 0, 20), pageOf([]));
  const overview: SampleOverview = {
    customerId: 1,
    sample: true,
    samples: [{ id: "REQ-2610-130", projectId: 1, type: "ALIMTALK", title: "[샘플] 알림톡 작성 연습", status: "DRAFT", createdAt: "2026-10-07T05:00:00Z" }],
    realRequestCount: 57,
  };
  client.setQueryData(opsKeys.samples(1), overview);
  const openTab = vi.fn();
  const props: WorkViewProps = {
    tab: { id: "t1", route: "opsSetup", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 5, name: "정우진", operator: true } as Me,
    context: { customers: [], projects: [], customer: null, project: null, customerId, projectId: null, projectsLoading: false },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab,
  };
  render(
    <QueryClientProvider client={client}>
      <OpsSetupView {...props} />
    </QueryClientProvider>,
  );
  return { openTab };
}

const samplePanel = () => screen.getByRole("region", { name: "샘플 요청·콘텐츠" });

afterEach(() => {
  useViewIntent.setState({ intents: {} });
});

describe("초기 설정·시드", () => {
  it("offers sample actions for a sample customer only", () => {
    setup(1);
    const panel = samplePanel();
    expect(within(panel).getByRole("button", { name: "샘플 요청 생성" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "샘플만 초기화" })).toBeTruthy();
    expect(within(panel).getByText("샘플 데이터 1건")).toBeTruthy();
    expect(within(panel).getByText("실제 운영 데이터 57건")).toBeTruthy();
    expect(within(panel).getByText(/REQ-2610-130/).textContent).toContain("작성 중");
  });

  it("explains instead of offering sample actions for a real customer (dashboard hand-off)", () => {
    requestOpsIntent("opsSetup", { customerId: 3 });
    setup(1);
    expect(screen.getByRole("combobox", { name: "고객사 선택" })).toHaveProperty("value", "3");
    const panel = samplePanel();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(within(panel).getByText(/샘플 데이터 작업은 샘플 고객사에서만 가능합니다/)).toBeTruthy();
    expect(screen.getByText("첫 고객사 관리자 초대 필요")).toBeTruthy();
  });

  it("shows the four steps with done marks and the sending info per project", () => {
    setup(1);
    const steps = screen.getByRole("list", { name: "초기 설정 단계" });
    expect(within(steps).getAllByText("완료").length).toBe(4);
    expect(within(steps).getByText("요청자 1명, 검수자 1명, 승인자 0명")).toBeTruthy();
    const row = screen.getByRole("row", { name: /카드 혜택 알림/ });
    expect(within(row).getByText("HB_POINT_01")).toBeTruthy();
    expect(within(row).getByText("1588-0000")).toBeTruthy();
  });

  it("switches the customer with the select and opens the assignment matrix for it", () => {
    const { openTab } = setup(1);
    fireEvent.change(screen.getByRole("combobox", { name: "고객사 선택" }), { target: { value: "3" } });
    expect(screen.getByText("미배정 문자, RCS")).toBeTruthy();
    // pending invitations come from the operator members list (contract §14.7)
    expect(screen.getByText("아직 수락한 관리자가 없습니다. · 초대 대기 admin@c3.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "배정 화면" }));
    expect(openTab).toHaveBeenCalledWith({ route: "opsStandards", params: {} });
    expect(decodeOpsIntent(useViewIntent.getState().intents.opsStandards)).toEqual({ customerId: 3, sub: "assign" });
  });
});

describe("setup steps model", () => {
  it("counts roles per project and marks steps", () => {
    const projects = [
      project(1, 3, { members: [{ userId: 1, roles: ["REQUESTER"] }, { userId: 2, roles: ["REVIEWER", "APPROVER"] }] }),
      project(2, 3, { members: [{ userId: 1, roles: ["REQUESTER"] }] }),
    ];
    expect(memberCounts(projects)).toEqual({ requesters: 2, reviewers: 1, approvers: 1 });
    const steps = setupSteps(realCustomer, []);
    expect(steps.map((s) => [s.key, s.done, s.status])).toEqual([
      ["admin", false, "아직 없습니다. 관리자를 먼저 초대하세요."],
      ["project", false, "프로젝트가 없습니다."],
      ["members", false, "요청자 0명, 검수자 0명"],
      ["datasets", false, "미배정 문자, RCS"],
    ]);
  });
});
