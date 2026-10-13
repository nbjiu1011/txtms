import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Me } from "@/entities/me";
import { noticeApi, noticeKeys, type Notice } from "@/entities/notice";
import type { Project } from "@/entities/project";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AdminNoticesView } from "./admin-notices-view";

const notice = (id: number, patch: Partial<Notice>): Notice => ({
  id,
  scope: "CUSTOMER",
  customerId: 1,
  projectId: null,
  title: `공지 ${id}`,
  body: "본문",
  authorId: 11,
  createdAt: "2026-10-05T00:00:00Z",
  publishedAt: "2026-10-05T00:00:00Z",
  edited: false,
  published: true,
  deleted: false,
  logs: [],
  ...patch,
});

const page = (content: Notice[]) => ({
  content,
  page: { number: 0, size: 20, totalElements: content.length, totalPages: 1 },
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(noticeKeys.managed(1, false, 0, 20), page([notice(1, {}), notice(2, { published: false })]));
  client.setQueryData(noticeKeys.managed(1, true, 0, 20), page([notice(3, { published: false, deleted: true })]));
  client.setQueryData(userKeys.byCustomer(1), [{ id: 11, name: "강민호" } as UserSummary]);
  const project = { id: 1, name: "카드 혜택 알림" } as Project;
  const props: WorkViewProps = {
    tab: { id: "t1", route: "adminNotices", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 1, adminCustomerIds: [1], memberships: [] } as unknown as Me,
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
  render(
    <QueryClientProvider client={client}>
      <AdminNoticesView {...props} />
    </QueryClientProvider>,
  );
  return props;
}

const row = (title: string) => screen.getByRole("button", { name: `${title} 상세 보기` }).closest("tr") as HTMLElement;

describe("AdminNoticesView", () => {
  it("shows the state and the publish actions that fit it", async () => {
    const publish = vi.spyOn(noticeApi, "publish").mockResolvedValue(notice(2, {}));
    setup();
    const live = within(row("공지 1"));
    expect(live.getByText("게시")).toBeTruthy();
    expect(live.getByRole("button", { name: "게시 중지" })).toBeTruthy();
    expect(live.queryByRole("button", { name: "게시" })).toBeNull();
    fireEvent.click(live.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("dialog", { name: "공지를 삭제할까요?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    const draft = within(row("공지 2"));
    expect(draft.getByText("미게시")).toBeTruthy();
    fireEvent.click(draft.getByRole("button", { name: "게시" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(2));
    vi.restoreAllMocks();
  });

  it("lists the deleted notices separately with 복원 only", async () => {
    const restore = vi.spyOn(noticeApi, "restore").mockResolvedValue(notice(3, { published: false }));
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "삭제된 공지" }));
    const trashed = within(await waitFor(() => row("공지 3")));
    expect(screen.queryByText("공지 1")).toBeNull();
    expect(trashed.getByText("삭제")).toBeTruthy();
    expect(trashed.queryByRole("button", { name: "수정" })).toBeNull();
    fireEvent.click(trashed.getByRole("button", { name: "복원" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(3));
    vi.restoreAllMocks();
  });
});
