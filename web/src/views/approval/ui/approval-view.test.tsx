import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT, requestListU1 } from "@fixtures/api-snapshot";
import { http, type Page } from "@/shared/api";
import type { Customer } from "@/entities/customer";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { requestKeys, type RequestSummary } from "@/entities/request";
import type { UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { ApprovalView } from "./approval-view";

type Query = Record<string, unknown>;

/** Rows per server view (mutable: an approval shrinks the queue). */
function fakeServer(counts: Record<string, number>) {
  const snap = API_SNAPSHOT[4];
  const get = vi.spyOn(http, "get").mockImplementation(async (path: string, options?: { query?: Query }) => {
    if (path === "/customers/1/users") return snap["/customers/1/users"] as UserSummary[];
    if (path !== "/requests") throw new Error(`unexpected GET ${path}`);
    const q = options?.query ?? {};
    const view = String(q.view);
    const page = Number(q.page);
    const size = Number(q.size);
    const all = Array.from({ length: counts[view] ?? 0 }, (_, i) => ({
      ...requestListU1.content[0],
      id: `REQ-${view}-${i + 1}`,
      title: `${view} ${i + 1}`,
    }));
    const body: Page<RequestSummary> = {
      content: all.slice(page * size, page * size + size),
      page: { number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) },
    };
    return body;
  });
  return get;
}

function setup() {
  const snap = API_SNAPSHOT[4];
  const customers = snap["/customers"] as Customer[];
  const projects = snap["/customers/1/projects"] as Project[];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: WorkViewProps = {
    tab: { id: "t1", route: "approval", params: {}, dirty: false, title: null },
    active: true,
    me: snap["/me"] as Me,
    context: {
      customers,
      projects,
      customer: customers[0],
      project: projects.find((p) => p.id === 1) ?? null,
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
      <ApprovalView {...props} />
    </QueryClientProvider>,
  );
  return { client };
}

const queries = (get: ReturnType<typeof fakeServer>, view: string) =>
  get.mock.calls
    .filter(([p, o]) => p === "/requests" && (o?.query as Query | undefined)?.view === view)
    .map(([, o]) => o?.query as Query);

/** The panel (section) under a panel heading. */
const panel = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe("ApprovalView paging", () => {
  it("pages the queue and the processed list independently", async () => {
    const get = fakeServer({ APPROVAL_QUEUE: 21, APPROVAL_PROCESSED: 45 });
    setup();
    const queue = panel("승인 대기");
    const processed = panel("내가 처리한 요청");
    expect(await within(queue).findByText("APPROVAL_QUEUE 1")).toBeTruthy();
    expect(within(queue).getByText("21건")).toBeTruthy();
    expect(within(queue).getByText("1 / 2")).toBeTruthy();
    expect(await within(processed).findByText("APPROVAL_PROCESSED 1")).toBeTruthy();
    expect(within(processed).getByText("1 / 3")).toBeTruthy();
    expect(queries(get, "APPROVAL_QUEUE")[0]).toMatchObject({ projectId: 1, page: 0, size: 20 });

    fireEvent.click(within(processed).getByRole("button", { name: "다음" }));
    expect(await within(processed).findByText("APPROVAL_PROCESSED 21")).toBeTruthy();
    expect(within(processed).getByText("2 / 3")).toBeTruthy();
    // The queue stays on its first page.
    expect(within(queue).getByText("1 / 2")).toBeTruthy();
    expect(queries(get, "APPROVAL_QUEUE").every((q) => q.page === 0)).toBe(true);
  });

  it("falls back to the last page when the queue's last page empties", async () => {
    const counts = { APPROVAL_QUEUE: 21, APPROVAL_PROCESSED: 0 };
    fakeServer(counts);
    const { client } = setup();
    const queue = panel("승인 대기");
    await within(queue).findByText("APPROVAL_QUEUE 1");
    fireEvent.click(within(queue).getByRole("button", { name: "다음" }));
    expect(await within(queue).findByText("APPROVAL_QUEUE 21")).toBeTruthy();

    counts.APPROVAL_QUEUE = 20;
    await act(() => client.invalidateQueries({ queryKey: requestKeys.all }));
    // Page 2 no longer exists: back on page 1 with the new total, and no pager for one page.
    await waitFor(() => {
      expect(within(queue).getByText("APPROVAL_QUEUE 1")).toBeTruthy();
      expect(within(queue).getByText("20건")).toBeTruthy();
      expect(within(queue).queryByRole("button", { name: "이전" })).toBeNull();
    });
    expect(within(queue).queryByText("APPROVAL_QUEUE 21")).toBeNull();
  });
});
