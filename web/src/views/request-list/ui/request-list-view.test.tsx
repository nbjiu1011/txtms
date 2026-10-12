import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT, requestListU1 } from "@fixtures/api-snapshot";
import { http, type Page } from "@/shared/api";
import type { Customer } from "@/entities/customer";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { requestKeys, type RequestSummary } from "@/entities/request";
import type { UserSummary } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { RequestListView } from "./request-list-view";

type Query = Record<string, unknown>;

/** Server stand-in: `count` requests of project 1, paged like `GET /api/requests`. */
function fakeServer(initialCount: number) {
  const state = { count: initialCount };
  const snap = API_SNAPSHOT[1];
  const get = vi.spyOn(http, "get").mockImplementation(async (path: string, options?: { query?: Query }) => {
    if (path === "/customers/1/users") return snap["/customers/1/users"] as UserSummary[];
    if (path !== "/requests") throw new Error(`unexpected GET ${path}`);
    const q = options?.query ?? {};
    const page = Number(q.page);
    const size = Number(q.size);
    const all = Array.from({ length: q.type === "SMS" ? 3 : state.count }, (_, i) => ({
      ...requestListU1.content[0],
      id: `REQ-T-${String(i + 1).padStart(3, "0")}`,
      title: `테스트 요청 ${i + 1}`,
    }));
    const body: Page<RequestSummary> = {
      content: all.slice(page * size, page * size + size),
      page: { number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) },
    };
    return body;
  });
  return { state, get };
}

function setup() {
  const snap = API_SNAPSHOT[1];
  const customers = snap["/customers"] as Customer[];
  const projects = snap["/customers/1/projects"] as Project[];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: WorkViewProps = {
    tab: { id: "t1", route: "requests", params: {}, dirty: false, title: null },
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
      <RequestListView {...props} />
    </QueryClientProvider>,
  );
  return { client };
}

const lastQuery = (get: ReturnType<typeof fakeServer>["get"]) =>
  get.mock.calls.filter(([p]) => p === "/requests").at(-1)?.[1]?.query as Query;

afterEach(() => vi.restoreAllMocks());

describe("RequestListView paging", () => {
  it("asks the server for 20 rows per page and pages with 이전 / 다음", async () => {
    const { get } = fakeServer(45);
    setup();
    expect(await screen.findByText("테스트 요청 1")).toBeTruthy();
    expect(lastQuery(get)).toMatchObject({ projectId: 1, page: 0, size: 20 });
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.queryByText("테스트 요청 21")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("테스트 요청 21")).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(lastQuery(get)).toMatchObject({ page: 1, size: 20 });

    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(await screen.findByText("테스트 요청 1")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("goes back to the first page when a filter changes", async () => {
    const { get } = fakeServer(45);
    setup();
    await screen.findByText("테스트 요청 1");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await screen.findByText("2 / 3");
    fireEvent.change(screen.getByLabelText("유형"), { target: { value: "SMS" } });
    await waitFor(() => expect(lastQuery(get)).toMatchObject({ type: "SMS", page: 0, size: 20 }));
    await waitFor(() => expect(screen.queryByText("2 / 3")).toBeNull());
    expect(await screen.findByText("테스트 요청 3")).toBeTruthy();
    // A single page hides the pager.
    expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
  });

  it("moves to the last page when the current one empties after a change", async () => {
    const { state } = fakeServer(45);
    const { client } = setup();
    await screen.findByText("테스트 요청 1");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await screen.findByText("2 / 3");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("테스트 요청 41")).toBeTruthy();

    state.count = 40;
    await act(() => client.invalidateQueries({ queryKey: requestKeys.all }));
    expect(await screen.findByText("2 / 2")).toBeTruthy();
    expect(await screen.findByText("테스트 요청 40")).toBeTruthy();
    expect(screen.queryByText("테스트 요청 41")).toBeNull();
  });
});
