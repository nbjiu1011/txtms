import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { chooseValue } from "@/shared/common/testing";
import type { Me } from "@/entities/me";
import { projectApi, projectKeys, type Project } from "@/entities/project";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AdminProjectsView } from "./admin-projects-view";

const lastToast = () => useToastStore.getState().message;

const project = (id: number, patch: Partial<Project>): Project => ({
  id,
  customerId: 1,
  name: `프로젝트 ${id}`,
  active: true,
  leadUserId: 3,
  templates: [{ code: "HB_POINT_01", name: "포인트 적립 안내" }],
  members: [
    { userId: 3, roles: ["REVIEWER"] },
    { userId: 1, roles: ["REQUESTER"] },
  ],
  variablesRevision: 0,
  activeRequestCount: 0,
  deletable: false,
  ...patch,
});

const user = (id: number, name: string, active = true): UserSummary => ({
  id,
  name,
  dept: "운영팀",
  email: `u${id}@x.test`,
  active,
  avatarColor: "#123456",
});

const rows = [project(1, { activeRequestCount: 2 }), project(2, { active: false, deletable: true })];
const page = { content: rows, page: { number: 0, size: 20, totalElements: rows.length, totalPages: 1 } };
const users = [user(1, "김서연"), user(3, "이도현"), user(7, "한가을"), user(9, "퇴사자", false)];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(projectKeys.managed(1, 0, 20), page);
  client.setQueryData(userKeys.byCustomer(1), users);
  // refetches after a save answer with the same data
  vi.spyOn(http, "get").mockImplementation((path: string) =>
    Promise.resolve(path.includes("/projects/manage") ? page : path.includes("/users") ? users : []) as never,
  );
  const props: WorkViewProps = {
    tab: { id: "t1", route: "adminProjects", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 11, adminCustomerIds: [1], memberships: [] } as unknown as Me,
    context: {
      customers: [],
      projects: rows,
      customer: { id: 1, name: "한빛카드", approvalEnabled: false } as WorkViewProps["context"]["customer"],
      project: rows[0],
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
      <AdminProjectsView {...props} />
    </QueryClientProvider>,
  );
}

const row = (name: string) => screen.getByRole("button", { name: `${name} 정보` }).closest("tr") as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe("AdminProjectsView", () => {
  it("offers the actions that fit each project", () => {
    setup();
    const live = within(row("프로젝트 1"));
    expect(live.getByRole("button", { name: "수정" })).toBeTruthy();
    expect(live.getByRole("button", { name: "구성원" })).toBeTruthy();
    expect(live.getByRole("button", { name: "사용 중지" })).toBeTruthy();
    expect(live.queryByRole("button", { name: "삭제" })).toBeNull();
    const stopped = within(row("프로젝트 2"));
    expect(stopped.getByText("중지")).toBeTruthy();
    expect(stopped.getByRole("button", { name: "사용" })).toBeTruthy();
    expect(stopped.getByRole("button", { name: "삭제" })).toBeTruthy();
  });

  it("shows the project information and moves on to 구성원 관리", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 1 정보" }));
    const info = await screen.findByRole("dialog", { name: "프로젝트 1" });
    expect(within(info).getByText("2건")).toBeTruthy();
    expect(within(info).getByText("포인트 적립 안내 (HB_POINT_01)")).toBeTruthy();
    expect(within(info).getByText("대표 검수자, 검수자")).toBeTruthy();
    fireEvent.click(within(info).getByRole("button", { name: "구성원 관리" }));
    expect(await screen.findByRole("dialog", { name: "프로젝트 1 구성원" })).toBeTruthy();
  });

  it("adds a member with a role and saves the whole participation", async () => {
    const setMembers = vi.spyOn(projectApi, "setMembers").mockResolvedValue(project(1, {}));
    setup();
    fireEvent.click(within(row("프로젝트 1")).getByRole("button", { name: "구성원" }));
    const dialog = await screen.findByRole("dialog", { name: "프로젝트 1 구성원" });
    // the lead keeps the reviewer role and cannot be removed here; deactivated users cannot be added
    expect((within(dialog).getByRole("checkbox", { name: "이도현 검수자" }) as HTMLInputElement).disabled).toBe(true);
    expect(within(dialog).getByRole("button", { name: "이도현 제외" }).getAttribute("aria-disabled")).toBe("true");
    chooseValue(within(dialog).getByLabelText("추가할 사용자"), "7");
    fireEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(lastToast()).toBe("추가한 구성원의 역할을 하나 이상 선택하세요"));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "한가을 요청자" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "김서연 제외" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(setMembers).toHaveBeenCalledWith(1, [
        { userId: 3, roles: ["REVIEWER"] },
        { userId: 7, roles: ["REQUESTER"] },
      ]),
    );
    await waitFor(() => expect(lastToast()).toBe("구성원을 저장했습니다"));
  });

  it("stops after confirmation and deletes a project without history", async () => {
    const update = vi.spyOn(projectApi, "update").mockResolvedValue(project(1, { active: false }));
    const remove = vi.spyOn(projectApi, "remove").mockResolvedValue(undefined);
    setup();
    fireEvent.click(within(row("프로젝트 1")).getByRole("button", { name: "사용 중지" }));
    const stop = await screen.findByRole("dialog", { name: "프로젝트를 사용 중지할까요?" });
    expect(within(stop).getByText(/진행 중인 요청이 2건 있습니다/)).toBeTruthy();
    fireEvent.click(within(stop).getByRole("button", { name: "사용 중지" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, { active: false }));

    fireEvent.click(within(row("프로젝트 2")).getByRole("button", { name: "삭제" }));
    const del = await screen.findByRole("dialog", { name: "프로젝트를 삭제할까요?" });
    fireEvent.click(within(del).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
    await waitFor(() => expect(lastToast()).toBe("프로젝트를 삭제했습니다"));
  });

  it("resumes a stopped project at once", async () => {
    const update = vi.spyOn(projectApi, "update").mockResolvedValue(project(2, {}));
    setup();
    fireEvent.click(within(row("프로젝트 2")).getByRole("button", { name: "사용" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(2, { active: true }));
  });
});
