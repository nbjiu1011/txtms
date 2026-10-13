import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT, requestListU1 } from "@fixtures/api-snapshot";
import { http, type Page } from "@/shared/api";
import type { Customer } from "@/entities/customer";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import type { RequestSummary } from "@/entities/request";
import type { UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { ReviewView } from "./review-view";

type Query = Record<string, unknown>;

/** Rows per server view; every list is paged like `GET /api/requests`. */
const COUNTS: Record<string, number> = {
  WAITING_ASSIGNMENT: 25,
  OVERDUE: 3,
  DUE_SOON: 0,
  MY_ASSIGNED_ACTIVE: 22,
  MY_ASSIGNED_DONE: 41,
};

function fakeServer() {
  const snap = API_SNAPSHOT[3];
  return vi.spyOn(http, "get").mockImplementation(async (path: string, options?: { query?: Query }) => {
    if (path === "/customers/1/users") return snap["/customers/1/users"] as UserSummary[];
    if (path === "/projects/1/workload") return [];
    if (path !== "/requests") throw new Error(`unexpected GET ${path}`);
    const q = options?.query ?? {};
    const view = String(q.view);
    const page = Number(q.page);
    const size = Number(q.size);
    const all = Array.from({ length: COUNTS[view] ?? 0 }, (_, i) => ({
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
}

function setup() {
  const snap = API_SNAPSHOT[3];
  const customers = snap["/customers"] as Customer[];
  const projects = snap["/customers/1/projects"] as Project[];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: WorkViewProps = {
    tab: { id: "t1", route: "review", params: {}, dirty: false, title: null },
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
      <ReviewView {...props} />
    </QueryClientProvider>,
  );
}

const queries = (get: ReturnType<typeof fakeServer>, view: string) =>
  get.mock.calls
    .filter(([p, o]) => p === "/requests" && (o?.query as Query | undefined)?.view === view)
    .map(([, o]) => o?.query as Query);

afterEach(() => vi.restoreAllMocks());

describe("ReviewView paging", () => {
  it("pages each 배정 관리 queue on its own, with the whole queue counted in the header", async () => {
    const get = fakeServer();
    setup();
    const waiting = screen.getByRole("region", { name: "배정 대기" });
    expect(await within(waiting).findByText("WAITING_ASSIGNMENT 1")).toBeTruthy();
    expect(within(waiting).getByText("25건")).toBeTruthy();
    expect(within(waiting).getByText("1 / 2")).toBeTruthy();
    expect(queries(get, "WAITING_ASSIGNMENT")[0]).toMatchObject({ projectId: 1, page: 0, size: 20 });

    // A single-page queue shows no pager.
    const overdue = screen.getByRole("region", { name: "지연" });
    expect(await within(overdue).findByText("3건")).toBeTruthy();
    expect(within(overdue).queryByRole("button", { name: "다음" })).toBeNull();

    fireEvent.click(within(waiting).getByRole("button", { name: "다음" }));
    expect(await within(waiting).findByText("WAITING_ASSIGNMENT 21")).toBeTruthy();
    expect(within(waiting).getByText("2 / 2")).toBeTruthy();
    expect(within(waiting).getByText("25건")).toBeTruthy();
    expect(queries(get, "WAITING_ASSIGNMENT").at(-1)).toMatchObject({ page: 1, size: 20 });
    expect(queries(get, "OVERDUE").every((q) => q.page === 0)).toBe(true);
  });

  it("pages 내 검수 and returns to the first page when 진행 중 / 완료 changes", async () => {
    const get = fakeServer();
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "내 검수" }));
    expect(await screen.findByText("MY_ASSIGNED_ACTIVE 1")).toBeTruthy();
    expect(queries(get, "MY_ASSIGNED_ACTIVE")[0]).toMatchObject({ page: 0, size: 20 });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("MY_ASSIGNED_ACTIVE 21")).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "완료" }));
    expect(await screen.findByText("MY_ASSIGNED_DONE 1")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    await waitFor(() => expect(queries(get, "MY_ASSIGNED_DONE").every((q) => q.page === 0)).toBe(true));
  });
});
