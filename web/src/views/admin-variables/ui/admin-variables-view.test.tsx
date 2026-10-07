import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "@/shared/ui";
import type { Me } from "@/entities/me";
import type { Project } from "@/entities/project";
import { variableApi, variableKeys, type ProjectVariableLog, type Variable } from "@/entities/variable";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AdminVariablesView } from "./admin-variables-view";

const variable = (id: number, key: string, patch: Partial<Variable> = {}): Variable => ({
  id,
  projectId: 1,
  key,
  description: `${key} 설명`,
  type: "TEXT",
  value: "값",
  active: true,
  inUse: false,
  deleted: false,
  createdBy: 1,
  createdAt: "2026-10-01T01:00:00Z",
  updatedAt: "2026-10-01T01:00:00Z",
  ...patch,
});

function setup(variables: Variable[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(variableKeys.adminByProject(1), variables);
  // newest first, like `GET /api/projects/{id}/variable-logs`
  const logs: ProjectVariableLog[] = variables.flatMap((v) => [
    ...(v.deleted
      ? [{ variableId: v.id, at: "2026-10-02T01:00:00Z", actorId: 1, actorName: "강민호", action: "삭제 (이력 보존)", before: null, after: null }]
      : []),
    { variableId: v.id, at: "2026-10-01T01:00:00Z", actorId: 1, actorName: "강민호", action: "등록", before: null, after: null },
  ]);
  client.setQueryData(variableKeys.projectLogs(1), logs);
  const project = { id: 1, name: "카드 혜택 알림" } as Project;
  const props: WorkViewProps = {
    tab: { id: "t1", route: "adminVariables", params: {}, dirty: false, title: null },
    active: true,
    me: { id: 11 } as Me,
    context: {
      customers: [],
      projects: [project],
      customer: null,
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
      <AdminVariablesView {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("AdminVariablesView", () => {
  it("marks variables in use and blocks their deletion; unused ones can be deleted", async () => {
    const remove = vi.spyOn(variableApi, "remove").mockResolvedValue(undefined);
    setup([variable(1, "customer_name", { inUse: true }), variable(2, "card_name"), variable(3, "old", { active: false })]);
    const row = (key: string) => screen.getByRole("row", { name: new RegExp(key) });

    expect(within(row("customer_name")).getByText("활성 · 사용 중")).toBeTruthy();
    expect(within(row("card_name")).getByText("활성")).toBeTruthy();
    expect(within(row("old")).getByText("중지")).toBeTruthy();
    expect(within(row("card_name")).getByText("10/1 10:00 등록")).toBeTruthy();

    const inUseDelete = within(row("customer_name")).getByRole("button", { name: "삭제" }) as HTMLButtonElement;
    expect(inUseDelete.disabled).toBe(true);
    expect(inUseDelete.title).toBe("사용 중인 변수는 삭제할 수 없습니다");

    fireEvent.click(within(row("card_name")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(2));
  });

  it("lists deleted variables as 삭제 with their history and no actions (reference 삭제 (이력 보존))", () => {
    setup([variable(1, "customer_name"), variable(4, "gone", { deleted: true, active: false })]);
    const row = screen.getByRole("row", { name: /gone/ });
    expect(within(row).getAllByRole("cell")[4].textContent).toBe("삭제");
    expect(row.textContent).toContain("10/1 10:00 등록");
    expect(row.textContent).toContain("10/2 10:00 삭제 (이력 보존)");
    expect(row.textContent!.indexOf("등록")).toBeLessThan(row.textContent!.indexOf("삭제 (이력"));
    expect((within(row).getByRole("button", { name: "편집" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(row).getByRole("button", { name: "삭제" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens the edit modal with the variable values", () => {
    setup([variable(1, "customer_name", { inUse: true })]);
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(screen.getByRole("heading", { name: "변수 편집" })).toBeTruthy();
    expect((screen.getByLabelText(/변수 키/) as HTMLInputElement).value).toBe("customer_name");
    fireEvent.change(screen.getByLabelText(/변수 키/), { target: { value: "customer" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    return waitFor(() => expect(useToastStore.getState().message).toBe("사용 중인 변수는 키를 변경할 수 없습니다"));
  });
});
