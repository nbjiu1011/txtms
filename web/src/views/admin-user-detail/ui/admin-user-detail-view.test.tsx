import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, http } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { memberApi, memberKeys, type DeactivationImpact, type Member } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AdminUserDetailView } from "./admin-user-detail-view";

const lastToast = () => useToastStore.getState().message;

const member = (patch: Partial<Member> = {}): Member => ({
  user: { id: 5, name: "박지훈", dept: "콘텐츠검수팀", email: "jihoon@hanbitcard.co.kr", active: true, avatarColor: "#000" },
  pending: false,
  admin: false,
  projects: [{ projectId: 1, roles: ["REVIEWER"], lead: true }],
  invitationExpiresAt: null,
  pendingEmail: null,
  ...patch,
});

const impact: DeactivationImpact = {
  reviewing: [
    {
      id: "REQ-2610-121",
      title: "적립 안내",
      status: "IN_REVIEW",
    } as DeactivationImpact["reviewing"][number],
  ],
  requesting: [],
  leadProjects: [{ id: 1, name: "카드 혜택 알림" } as Project],
  lastApproverProjects: [],
  lastAdmin: false,
  substitutes: [],
};

function setup(data: Member | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (data) client.setQueryData(memberKeys.detail(1, 5), data);
  client.setQueryData(memberKeys.impact(1, 5), impact);
  const project = { id: 1, name: "카드 혜택 알림", leadUserId: 5, members: [] } as unknown as Project;
  const props: WorkViewProps = {
    tab: { id: "t1", route: "adminUser", params: { id: "5" }, dirty: false, title: null },
    active: true,
    me: { id: 11, adminCustomerIds: [1], memberships: [] } as unknown as Me,
    context: {
      customers: [],
      projects: [project],
      customer: { id: 1, name: "한빛카드", domain: "hanbitcard.co.kr", approvalEnabled: true } as WorkViewProps["context"]["customer"],
      project,
      customerId: 1,
      projectId: 1,
      projectsLoading: false,
    },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab: vi.fn(),
  };
  render(
    <QueryClientProvider client={client}>
      <AdminUserDetailView {...props} />
    </QueryClientProvider>,
  );
  return props;
}

afterEach(() => vi.restoreAllMocks());

/** Refetches after a save answer with this member (and the same work in progress). */
function refetchWith(m: Member) {
  vi.spyOn(http, "get").mockImplementation(
    (path: string) => Promise.resolve(path.endsWith("/deactivation-impact") ? impact : m) as never,
  );
}

describe("AdminUserDetailView", () => {
  it("shows the information, roles and work in progress; names the tab", async () => {
    const props = setup(member({ pendingEmail: "new@hanbitcard.co.kr" }));
    expect(screen.getByRole("heading", { name: "박지훈" })).toBeTruthy();
    expect(screen.getByText("콘텐츠검수팀")).toBeTruthy();
    expect(screen.getByText("new@hanbitcard.co.kr")).toBeTruthy();
    expect(screen.getByText("검수자, 대표 검수자")).toBeTruthy();
    expect(screen.getByText("검수 중 1건")).toBeTruthy();
    await waitFor(() => expect(props.setTitle).toHaveBeenCalledWith("박지훈"));
    fireEvent.click(screen.getByRole("button", { name: /REQ-2610-121/ }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "request", params: { id: "REQ-2610-121" } });
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "adminUsers", params: {} });
  });

  it("edits the name and department", async () => {
    refetchWith(member());
    const update = vi.spyOn(memberApi, "updateProfile").mockResolvedValue(member({ user: { ...member().user, name: "박검수" } }));
    setup(member());
    fireEvent.click(screen.getByRole("button", { name: "정보 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "사용자 정보 수정" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /이름/ }), { target: { value: " " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(lastToast()).toBe("이름을(를) 입력하세요"));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /이름/ }), { target: { value: "박검수" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "소속" }), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, 5, { name: "박검수", dept: "" }));
    await waitFor(() => expect(lastToast()).toBe("사용자 정보를 저장했습니다"));
  });

  it("grants the admin right after confirmation; a refusal keeps the dialog", async () => {
    refetchWith(member());
    const setAdmin = vi
      .spyOn(memberApi, "setAdmin")
      .mockRejectedValueOnce(new ApiError(409, { code: "REQUEST_STATE_CONFLICT", message: "활성 사용자만 관리자로 지정할 수 있습니다" }))
      .mockResolvedValueOnce(member({ admin: true }));
    setup(member());
    fireEvent.click(screen.getByRole("button", { name: "관리자 지정" }));
    const dialog = await screen.findByRole("dialog", { name: "고객사 관리자로 지정할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "관리자 지정" }));
    await waitFor(() => expect(lastToast()).toBe("활성 사용자만 관리자로 지정할 수 있습니다"));
    fireEvent.click(within(dialog).getByRole("button", { name: "관리자 지정" }));
    await waitFor(() => expect(setAdmin).toHaveBeenCalledTimes(2));
    expect(setAdmin).toHaveBeenLastCalledWith(1, 5, true);
  });

  it("adapts the account actions to the state", () => {
    setup(member({ pending: true, user: { ...member().user, active: false }, invitationExpiresAt: "2026-10-20T00:00:00Z" }));
    expect(screen.getByText("초대를 수락하지 않은 사용자입니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "초대 재발급" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "비활성화" })).toBeNull();
    expect(screen.queryByRole("button", { name: "관리자 지정" })).toBeNull();
    expect(screen.queryByText("진행 업무")).toBeNull();
  });

  it("an inactive user can be reactivated", () => {
    setup(member({ user: { ...member().user, active: false } }));
    expect(screen.getByText("비활성화된 사용자입니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "재활성화" })).toBeTruthy();
  });

  it("reports a user of another customer", async () => {
    vi.spyOn(http, "get").mockRejectedValue(new ApiError(404, { code: "NOT_FOUND", message: "찾을 수 없습니다" }));
    setup(null);
    expect(await screen.findByText("사용자를 찾을 수 없습니다")).toBeTruthy();
  });
});
