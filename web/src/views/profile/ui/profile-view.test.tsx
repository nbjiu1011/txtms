import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Customer } from "@/entities/customer";
import { useSessionStore, type Me } from "@/entities/me";
import { projectKeys, type Project } from "@/entities/project";
import type { WorkContext } from "@/widgets/app-shell";
import { accountRoleLabels, profileRoleRows } from "../model/roles";
import { ProfileView } from "./profile-view";

const customer = (id: number, name: string): Customer => ({
  id,
  name,
  domain: `c${id}.test`,
  approvalEnabled: true,
  active: true,
  sample: true,
  notifyChannel: "IN_APP",
  dueSoonDays: 3,
  createdAt: "2026-10-01T00:00:00Z",
});
const project = (id: number, customerId: number, name: string): Project => ({
  id,
  customerId,
  name,
  active: true,
  leadUserId: null,
  templates: [],
  senders: [],
  members: [],
  variablesRevision: 0,
});
const customers = [customer(1, "한빛카드"), customer(2, "도담생명")];

const me: Me = {
  id: 3,
  name: "이도현",
  dept: "고객경험팀",
  email: "dohyun.lee@hanbitcard.co.kr",
  customerId: 1,
  operator: false,
  adminCustomerIds: [1],
  avatarColor: "#5B7CFA",
  demo: false,
  memberships: [
    { projectId: 1, customerId: 1, roles: ["REVIEWER", "REQUESTER"], lead: true },
    { projectId: 2, customerId: 1, roles: ["APPROVER"], lead: false },
  ],
  session: { remember: false, expiresAt: "2026-10-08T05:30:00Z" },
};

function renderProfile(user: Me) {
  useSessionStore.getState().setMe(user);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(projectKeys.byCustomer(1), [project(1, 1, "카드 혜택 알림"), project(2, 1, "리스크 고지 문자")]);
  client.setQueryData(projectKeys.byCustomer(2), [project(3, 2, "보험 안내")]);
  const context = { customers } as unknown as WorkContext;
  render(
    <QueryClientProvider client={client}>
      <ProfileView context={context} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  useSessionStore.getState().setAnonymous();
});

describe("ProfileView", () => {
  it("shows the profile, customer and project roles read-only, the password form and logout", () => {
    renderProfile(me);

    expect(screen.getByRole("heading", { name: "내 설정" })).toBeTruthy();
    expect(screen.getByText("dohyun.lee@hanbitcard.co.kr")).toBeTruthy();
    expect(screen.getByText("한빛카드 · 고객경험팀")).toBeTruthy();
    expect((screen.getByLabelText("이름") as HTMLInputElement).value).toBe("이도현");
    expect((screen.getByLabelText("소속") as HTMLInputElement).value).toBe("고객경험팀");

    const roles = screen.getByRole("heading", { name: "소속과 역할" }).closest("section") as HTMLElement;
    const row = (label: string) => within(roles).getByText(label).nextElementSibling as HTMLElement;
    expect(row("고객사").textContent).toBe("한빛카드");
    // contract order (요청자 · 검수자), then the 대표 검수자 badge
    expect(within(row("카드 혜택 알림")).getAllByText(/./).map((t) => t.textContent)).toEqual([
      "요청자",
      "검수자",
      "대표 검수자",
    ]);
    expect(row("리스크 고지 문자").textContent).toBe("승인자");
    expect(row("관리 권한").textContent).toBe("고객사 관리자");
    // read-only: no inputs in the roles panel
    expect(within(roles).queryAllByRole("textbox")).toHaveLength(0);

    expect(screen.getByRole("form", { name: "비밀번호 변경" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(screen.queryByText(/프로토타입/)).toBeNull();
  });

  it("shows 역할 없음 without memberships and names the operator role", () => {
    renderProfile({ ...me, memberships: [], adminCustomerIds: [], customerId: null, operator: true });
    const roles = screen.getByRole("heading", { name: "소속과 역할" }).closest("section") as HTMLElement;
    expect(within(roles).getByText("관리 권한").nextElementSibling?.textContent).toBe("솔루션 운영 담당자");
    expect(within(roles).getByText("고객사").nextElementSibling?.textContent).toBe("-");
  });
});

describe("profile role rows", () => {
  const projectNames = new Map([
    [1, "카드 혜택 알림"],
    [3, "보험 안내"],
  ]);
  const customerNames = new Map([
    [1, "한빛카드"],
    [2, "도담생명"],
  ]);

  it("adds the customer name only when memberships span customers and falls back for unloaded projects", () => {
    expect(profileRoleRows(me, projectNames, customerNames)).toEqual([
      { projectId: 1, projectName: "카드 혜택 알림", customerName: null, roles: ["요청자", "검수자"], lead: true },
      { projectId: 2, projectName: "프로젝트 2", customerName: null, roles: ["승인자"], lead: false },
    ]);
    const spanning = { ...me, memberships: [...me.memberships, { projectId: 3, customerId: 2, roles: ["REQUESTER" as const], lead: false }] };
    expect(profileRoleRows(spanning, projectNames, customerNames).map((r) => r.customerName)).toEqual([
      "한빛카드",
      "한빛카드",
      "도담생명",
    ]);
  });

  it("labels administered customers by name when it is not the own customer", () => {
    expect(accountRoleLabels(me, customerNames)).toEqual(["고객사 관리자"]);
    expect(accountRoleLabels({ ...me, adminCustomerIds: [2], operator: true }, customerNames)).toEqual([
      "고객사 관리자 (도담생명)",
      "솔루션 운영 담당자",
    ]);
  });
});
