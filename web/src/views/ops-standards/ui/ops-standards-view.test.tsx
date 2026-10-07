import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewIntent } from "@/shared/lib";
import { useToastStore } from "@/shared/ui";
import type { Me } from "@/entities/me";
import { opsApi, opsKeys, type Dataset, type DatasetAssignment, type OpsCustomer } from "@/entities/ops";
import type { ContentTypeSetting } from "@/entities/request";
import { requestOpsIntent } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { OpsStandardsView } from "./ops-standards-view";

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

const ds = (id: number, scope: Dataset["scope"], version: number, ruleCount: number): Dataset => ({
  id,
  scope,
  version,
  ruleCount,
  createdAt: "2026-10-01T01:00:00Z",
  createdBy: 5,
});

const datasets = [ds(1, "ALIMTALK", 1, 3), ds(2, "ALIMTALK", 2, 5), ds(3, "SMS", 1, 4), ds(4, "RCS", 1, 2), ds(5, "FREEFORM", 1, 1)];
const assignment = (customerId: number, type: DatasetAssignment["type"], datasetId: number, checked: boolean): DatasetAssignment => ({
  customerId,
  type,
  datasetId,
  assignedAt: "2026-10-01T01:00:00Z",
  assignedBy: 5,
  checkedAt: checked ? "2026-10-02T01:00:00Z" : null,
  checkedBy: checked ? 5 : null,
});
const types: ContentTypeSetting[] = [
  { type: "ALIMTALK", active: true, mockEnabled: true },
  { type: "SMS", active: true, mockEnabled: true },
  { type: "RCS", active: false, mockEnabled: true },
  { type: "FREEFORM", active: true, mockEnabled: false },
];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(opsKeys.customers(), [
    customer(1, "한빛카드"),
    customer(2, "도담생명", { unassignedDatasetTypes: ["SMS", "FREEFORM"] }),
  ]);
  client.setQueryData(opsKeys.datasets(), datasets);
  client.setQueryData(opsKeys.assignments(), [
    assignment(1, "ALIMTALK", 1, true),
    assignment(1, "SMS", 3, false),
    assignment(2, "ALIMTALK", 2, true),
  ]);
  client.setQueryData(opsKeys.contentTypes(), types);
  // keep the seeded lists after the post-write invalidation (no network in tests)
  vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  const props: WorkViewProps = {
    tab: { id: "t1", route: "opsStandards", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 5, name: "정우진", operator: true } as Me,
    context: { customers: [], projects: [], customer: null, project: null, customerId: 1, projectId: null, projectsLoading: false },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab: vi.fn(),
  };
  render(
    <QueryClientProvider client={client}>
      <OpsStandardsView {...props} />
    </QueryClientProvider>,
  );
}

const lastToast = () => useToastStore.getState().message;
const cell = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

afterEach(() => {
  vi.restoreAllMocks();
  useViewIntent.setState({ intents: {} });
  useToastStore.getState().dismiss();
});

describe("유효 데이터셋 배정 matrix", () => {
  it("shows one select per customer × type with versions, confirmation state and stopped types", () => {
    setup();
    expect(cell("한빛카드 알림톡 데이터셋").value).toBe("1");
    expect(within(cell("한빛카드 알림톡 데이터셋")).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "미배정",
      "v2  규칙 5개",
      "v1  규칙 3개",
    ]);
    expect(screen.getAllByText("10월 2일 확인 정우진").length).toBe(2);
    expect(screen.getByRole("button", { name: "한빛카드 문자 확인 처리" })).toBeTruthy();
    expect(cell("도담생명 문자 데이터셋").value).toBe("");
    expect(cell("한빛카드 RCS 데이터셋").disabled).toBe(true);
    expect(cell("한빛카드 RCS 데이터셋").title).toBe("사용하지 않는 유형입니다");
    expect(screen.getByText("미배정 2개")).toBeTruthy();
    expect(screen.getByText("배정 완료")).toBeTruthy();
  });

  it("assigns a new combination", async () => {
    const assign = vi.spyOn(opsApi, "assign").mockResolvedValue(assignment(2, "SMS", 3, false));
    setup();
    fireEvent.change(cell("도담생명 문자 데이터셋"), { target: { value: "3" } });
    await waitFor(() => expect(assign).toHaveBeenCalledWith(2, "SMS", 3));
    await waitFor(() => expect(lastToast()).toBe("문자 v1을 연결했습니다. 확인 처리까지 해 주세요"));
  });

  it("changes the version of an existing assignment and ignores the same one", async () => {
    const assign = vi.spyOn(opsApi, "assign").mockResolvedValue(assignment(1, "ALIMTALK", 2, false));
    setup();
    fireEvent.change(cell("한빛카드 알림톡 데이터셋"), { target: { value: "1" } });
    expect(assign).not.toHaveBeenCalled();
    fireEvent.change(cell("한빛카드 알림톡 데이터셋"), { target: { value: "2" } });
    await waitFor(() => expect(assign).toHaveBeenCalledWith(1, "ALIMTALK", 2));
    await waitFor(() => expect(lastToast()).toBe("알림톡 v2을 연결했습니다. 확인 처리까지 해 주세요"));
  });

  it("unassigns with 미배정", async () => {
    const unassign = vi.spyOn(opsApi, "unassign").mockResolvedValue(undefined);
    setup();
    fireEvent.change(cell("한빛카드 문자 데이터셋"), { target: { value: "" } });
    await waitFor(() => expect(unassign).toHaveBeenCalledWith(1, "SMS"));
    await waitFor(() => expect(lastToast()).toMatch(/^배정을 해제했습니다/));
  });

  it("confirms an unconfirmed assignment", async () => {
    const confirm = vi.spyOn(opsApi, "confirm").mockResolvedValue(assignment(1, "SMS", 3, true));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "한빛카드 문자 확인 처리" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(1, "SMS"));
  });

  it("shows a server refusal as a toast", async () => {
    vi.spyOn(opsApi, "assign").mockRejectedValue(new Error("문자 데이터셋만 배정할 수 있습니다"));
    setup();
    fireEvent.change(cell("도담생명 자유입력형 데이터셋"), { target: { value: "5" } });
    await waitFor(() => expect(lastToast()).toBe("문자 데이터셋만 배정할 수 있습니다"));
  });

  it("lists the effective datasets of the customer handed over by the dashboard", () => {
    requestOpsIntent("opsStandards", { customerId: 2, sub: "assign" });
    setup();
    expect(screen.getByRole("heading", { name: "도담생명 텍스트 교정에 실제 적용되는 기준" })).toBeTruthy();
    expect(screen.getByText("알림톡 v2 규칙 5개")).toBeTruthy();
    expect(screen.getByText("문자 미배정")).toBeTruthy();
    expect(screen.getByText("유형 미사용")).toBeTruthy();
  });
});

describe("유형 관리", () => {
  it("toggles a content type at once", async () => {
    const setActive = vi.spyOn(opsApi, "setContentTypeActive").mockResolvedValue({ type: "SMS", active: false, mockEnabled: true });
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "유형 관리" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "문자 사용" }));
    await waitFor(() => expect(setActive).toHaveBeenCalledWith("SMS", false));
  });
});
