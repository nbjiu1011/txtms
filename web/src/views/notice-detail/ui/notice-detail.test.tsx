import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api";
import { ApiError } from "@/shared/api";
import type { Me } from "@/entities/me";
import { noticeApi, noticeKeys, type Notice } from "@/entities/notice";
import type { Project } from "@/entities/project";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AdminNoticeDetailView } from "./admin-notice-detail-view";
import { NoticeDetailView } from "./notice-detail-view";

const notice = (patch: Partial<Notice> = {}): Notice => ({
  id: 7,
  scope: "PROJECT",
  customerId: 1,
  projectId: 1,
  title: "정기 점검 안내",
  body: "<p><strong>토요일</strong> 02시 점검</p>",
  authorId: 11,
  createdAt: "2026-10-05T00:00:00Z",
  publishedAt: "2026-10-05T00:00:00Z",
  edited: true,
  published: true,
  deleted: false,
  logs: [
    {
      at: "2026-10-05T01:00:00Z",
      actorId: 11,
      action: "수정",
      previousScope: "CUSTOMER",
      previousProjectId: null,
      previousTitle: "점검 안내",
      previousBody: "이전 본문",
    },
  ],
  ...patch,
});

function setup(view: (props: WorkViewProps) => ReactElement, data: Notice | null, me: Partial<Me> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (data) client.setQueryData(noticeKeys.detail(7), data);
  client.setQueryData(userKeys.byCustomer(1), [{ id: 11, name: "강민호" } as UserSummary]);
  const project = { id: 1, name: "카드 혜택 알림" } as Project;
  const props: WorkViewProps = {
    tab: { id: "t1", route: "notice", params: { id: "7" }, dirty: false, title: null },
    active: true,
    me: { id: 1, adminCustomerIds: [], memberships: [], ...me } as Me,
    context: {
      customers: [],
      projects: [project],
      customer: { id: 1, name: "한빛카드" } as WorkViewProps["context"]["customer"],
      project,
      customerId: 1,
      projectId: 1,
      projectsLoading: false,
    },
    setDirty: vi.fn(),
    setTitle: vi.fn(),
    openTab: vi.fn(),
  };
  render(<QueryClientProvider client={client}>{view(props)}</QueryClientProvider>);
  return props;
}

describe("NoticeDetailView", () => {
  it("shows the scope, author, time, 수정됨 and the formatted body; names the tab", async () => {
    const props = setup((p) => <NoticeDetailView {...p} />, notice());
    expect(screen.getByRole("heading", { name: "정기 점검 안내" })).toBeTruthy();
    expect(screen.getByText("프로젝트 공지 카드 혜택 알림")).toBeTruthy(); // matcher text is whitespace-normalized
    expect(screen.getByText("강민호")).toBeTruthy();
    expect(screen.getByText("수정됨")).toBeTruthy();
    expect(screen.getByText("토요일").tagName).toBe("STRONG");
    await waitFor(() => expect(props.setTitle).toHaveBeenCalledWith("정기 점검 안내"));
    expect(screen.queryByRole("button", { name: "공지 관리에서 보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "notices", params: {} });
  });

  it("offers the admin page to the customer's admins", () => {
    const props = setup((p) => <NoticeDetailView {...p} />, notice(), { adminCustomerIds: [1] });
    fireEvent.click(screen.getByRole("button", { name: "공지 관리에서 보기" }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "adminNotice", params: { id: "7" } });
  });

  it("reports a notice it may not read (unpublished, deleted or out of scope)", async () => {
    vi.spyOn(http, "get").mockRejectedValue(new ApiError(404, { code: "NOT_FOUND", message: "찾을 수 없습니다" }));
    setup((p) => <NoticeDetailView {...p} />, null);
    expect(await screen.findByText("공지를 찾을 수 없습니다")).toBeTruthy();
    vi.restoreAllMocks();
  });
});

describe("AdminNoticeDetailView", () => {
  it("shows the state, body and change history with the previous body on demand", () => {
    setup((p) => <AdminNoticeDetailView {...p} />, notice(), { adminCustomerIds: [1] });
    expect(screen.getAllByText("게시")).toHaveLength(2); // 게시 시각 label and the state tag
    expect(screen.getByText("점검 안내")).toBeTruthy();
    expect(screen.getByText("고객사 전체")).toBeTruthy();
    expect(screen.queryByText("이전 본문")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(screen.getByText("이전 본문")).toBeTruthy();
    expect(screen.getByRole("button", { name: "수정" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "게시 중지" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "삭제" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "게시" })).toBeNull();
  });

  it("opens the edit, 게시 중지 and 삭제 dialogs", async () => {
    setup((p) => <AdminNoticeDetailView {...p} />, notice(), { adminCustomerIds: [1] });
    fireEvent.click(screen.getByRole("button", { name: "게시 중지" }));
    expect(await screen.findByRole("dialog", { name: "게시를 중지할까요?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("dialog", { name: "공지를 삭제할까요?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(await screen.findByRole("dialog", { name: "공지 수정" })).toBeTruthy();
  });

  it("an unpublished notice says so and can be published", async () => {
    const publish = vi.spyOn(noticeApi, "publish").mockResolvedValue(notice());
    setup((p) => <AdminNoticeDetailView {...p} />, notice({ published: false }), { adminCustomerIds: [1] });
    expect(screen.getByText("미게시 공지입니다")).toBeTruthy();
    expect(screen.getByText("미게시")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "게시" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(7));
    vi.restoreAllMocks();
  });

  it("a deleted notice is read-only with a banner and can be restored", async () => {
    const restore = vi.spyOn(noticeApi, "restore").mockResolvedValue(notice({ published: false }));
    setup((p) => <AdminNoticeDetailView {...p} />, notice({ published: false, deleted: true }), {
      adminCustomerIds: [1],
    });
    expect(screen.getByText("삭제된 공지입니다")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "수정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "게시" })).toBeNull();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(7));
    vi.restoreAllMocks();
  });
});
