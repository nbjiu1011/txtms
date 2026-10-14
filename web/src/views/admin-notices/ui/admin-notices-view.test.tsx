import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Me } from "@/entities/me";
import { noticeKeys, type Notice } from "@/entities/notice";
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

const row = (title: string) =>
  screen.getByRole("button", { name: `${title} 상세 보기` }).closest('[role="row"]') as HTMLElement;

describe("AdminNoticesView", () => {
  it("shows the state of each notice; the rows have no action buttons and open the detail", () => {
    const props = setup();
    const live = within(row("공지 1"));
    expect(live.getByText("게시")).toBeTruthy();
    expect(live.getAllByRole("button").map((b) => b.textContent)).toEqual(["공지 1"]);
    expect(within(row("공지 2")).getByText("미게시")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "공지 2 상세 보기" }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "adminNotice", params: { id: "2" } });
    fireEvent.click(live.getAllByRole("cell")[1]);
    expect(props.openTab).toHaveBeenLastCalledWith({ route: "adminNotice", params: { id: "1" } });
  });

  it("lists the deleted notices separately", async () => {
    const props = setup();
    fireEvent.click(screen.getByRole("radio", { name: "삭제된 공지" }));
    const trashed = within(await waitFor(() => row("공지 3")));
    expect(screen.queryByText("공지 1")).toBeNull();
    expect(trashed.getByText("삭제")).toBeTruthy();
    expect(trashed.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "공지 3 상세 보기" }));
    expect(props.openTab).toHaveBeenCalledWith({ route: "adminNotice", params: { id: "3" } });
  });
});
