import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT } from "@fixtures/api-snapshot";
import { archiveContentsU1 } from "@fixtures/archive-snapshot";
import { http, type Page } from "@/shared/api";
import type { Customer } from "@/entities/customer";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import type { ArchiveLine } from "@/entities/request";
import type { WorkViewProps } from "@/widgets/app-shell";
import { ContentArchiveView } from "./content-archive-view";
import { chooseValue } from "@/shared/common/testing";

type Query = Record<string, unknown>;

/** Server stand-in: 45 lines (3 with the SMS filter), paged like `GET /api/archive/contents`. */
function fakeServer() {
  return vi.spyOn(http, "get").mockImplementation(async (path: string, options?: { query?: Query }) => {
    if (path === "/archive/campaigns") return [];
    if (path !== "/archive/contents") throw new Error(`unexpected GET ${path}`);
    const q = options?.query ?? {};
    const page = Number(q.page);
    const size = Number(q.size);
    const base = archiveContentsU1.content[0];
    const all: ArchiveLine[] = Array.from({ length: q.type === "SMS" ? 3 : 45 }, (_, i) => ({
      ...base,
      lineKey: `REQ-T-${i + 1}:C1`,
      latest: { ...base.latest, title: `보관 콘텐츠 ${i + 1}` },
    }));
    const body: Page<ArchiveLine> = {
      content: all.slice(page * size, page * size + size),
      page: { number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) },
    };
    return body;
  });
}

function setup() {
  const snap = API_SNAPSHOT[1];
  const customers = snap["/customers"] as Customer[];
  const projects = snap["/customers/1/projects"] as Project[];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: WorkViewProps = {
    tab: { id: "t1", route: "contents", params: {}, dirty: false, title: null },
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
      <ContentArchiveView {...props} />
    </QueryClientProvider>,
  );
}

const lastQuery = (get: ReturnType<typeof fakeServer>) =>
  get.mock.calls.filter(([p]) => p === "/archive/contents").at(-1)?.[1]?.query as Query;
const line = (n: number) => screen.queryByRole("listitem", { name: `보관 콘텐츠 ${n} v1` });

afterEach(() => vi.restoreAllMocks());

describe("ContentArchiveView paging", () => {
  it("shows 20 lines per page with page numbers instead of 더 보기", async () => {
    const get = fakeServer();
    setup();
    await waitFor(() => expect(line(1)).toBeTruthy());
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(lastQuery(get)).toMatchObject({ projectId: 1, page: 0, size: 20 });
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(line(21)).toBeTruthy());
    // The page replaces the previous one (no appending).
    expect(line(1)).toBeNull();
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(lastQuery(get)).toMatchObject({ page: 1, size: 20 });
  });

  it("goes back to the first page when a filter changes", async () => {
    const get = fakeServer();
    setup();
    await waitFor(() => expect(line(1)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await screen.findByText("2 / 3");
    chooseValue(screen.getByLabelText("유형"), "SMS");
    await waitFor(() => expect(lastQuery(get)).toMatchObject({ type: "SMS", page: 0, size: 20 }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
  });
});
