import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Me } from "@/entities/me";
import { noticeKeys, type Notice } from "@/entities/notice";
import type { Project } from "@/entities/project";
import { userKeys, type UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { NoticesView } from "./notices-view";

const notice = (id: number, patch: Partial<Notice>): Notice => ({
  id,
  scope: "CUSTOMER",
  customerId: 1,
  projectId: null,
  title: `공지 ${id}`,
  body: `본문 ${id}`,
  authorId: 11,
  createdAt: "2026-10-05T00:00:00Z",
  edited: false,
  withdrawn: false,
  logs: [],
  ...patch,
});

function setup(me: Partial<Me>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const notices = [
    notice(1, {}),
    notice(2, { scope: "PROJECT", projectId: 1, edited: true, createdAt: "2026-10-03T02:00:00Z" }),
  ];
  client.setQueryData(noticeKeys.visible(1, 0, 20), {
    content: notices,
    page: { number: 0, size: 20, totalElements: notices.length, totalPages: 1 },
  });
  client.setQueryData(userKeys.byCustomer(1), [{ id: 11, name: "강민호" } as UserSummary]);
  const openTab = vi.fn();
  const props: WorkViewProps = {
    tab: { id: "t1", route: "notices", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 1, adminCustomerIds: [], memberships: [], ...me } as Me,
    context: {
      customers: [],
      projects: [{ id: 1, name: "카드 혜택 알림" } as Project],
      customer: null,
      project: null,
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
      <NoticesView {...props} />
    </QueryClientProvider>,
  );
  return { openTab };
}

describe("NoticesView", () => {
  it("lists scope, author, time and 수정됨; a row opens the notice's detail tab", () => {
    const { openTab } = setup({});
    expect(screen.getByText(/^고객사 전체 공지\s+강민호\s+10\/5 09:00$/)).toBeTruthy();
    expect(screen.getByText(/^프로젝트 공지\s+카드 혜택 알림\s+강민호\s+10\/3 11:00\s+수정됨$/)).toBeTruthy();
    expect(screen.queryByText("본문 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /공지 1/ }));
    expect(openTab).toHaveBeenCalledWith({ route: "notice", params: { id: "1" } });
    expect(screen.queryByRole("button", { name: "공지 관리" })).toBeNull();
  });

  it("admins get 공지 관리", () => {
    const { openTab } = setup({ adminCustomerIds: [1] });
    fireEvent.click(screen.getByRole("button", { name: "공지 관리" }));
    expect(openTab).toHaveBeenCalledWith({ route: "adminNotices", params: {} });
  });
});
