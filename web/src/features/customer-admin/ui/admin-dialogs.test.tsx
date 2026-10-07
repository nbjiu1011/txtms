import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { noticeApi, type Notice } from "@/entities/notice";
import type { Project } from "@/entities/project";
import { memberApi, type DeactivationImpact, type Member } from "@/entities/user";
import { ChangeEmailDialog } from "./change-email-dialog";
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { InviteUserDialog } from "./invite-user-dialog";
import { NoticeEditDialog, WithdrawNoticeDialog } from "./notice-edit-dialog";
import { RoleEditDialog } from "./role-edit-dialog";

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const lastToast = () => useToastStore.getState().message;
const project = (id: number, name: string, leadUserId: number | null = null): Project => ({
  id,
  customerId: 1,
  name,
  active: true,
  leadUserId,
  templates: [],
  senders: [],
  members: [],
  variablesRevision: 0,
});
const projects = [project(1, "카드 혜택 알림", 3), project(2, "리스크 고지 문자")];
const member = (id: number, roles: Member["projects"], patch: Partial<Member> = {}): Member => ({
  user: { id, name: `사용자${id}`, dept: "팀", email: `u${id}@hanbitcard.co.kr`, active: true, avatarColor: "#000" },
  pending: false,
  admin: false,
  projects: roles,
  invitationExpiresAt: null,
  ...patch,
});

afterEach(() => {
  vi.restoreAllMocks();
  useToastStore.getState().dismiss();
});

describe("InviteUserDialog", () => {
  const customer = { id: 1, domain: "hanbitcard.co.kr", approvalEnabled: true };
  const open = () =>
    wrap(<InviteUserDialog open onClose={vi.fn()} customer={customer} projects={projects} projectId={1} />);

  it("asks once for an external domain, then invites with externalDomainConfirmed", async () => {
    const invite = vi.spyOn(memberApi, "invite").mockResolvedValue(member(20, []));
    open();
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "kim@partner.com" } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: "김협력" } });
    expect(screen.getByText("외부 도메인 이메일입니다. 초대 대상을 확인하세요.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "승인자" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "초대 링크 생성" }));
    await waitFor(() => expect(lastToast()).toMatch(/회사 도메인과 다른 이메일입니다/));
    expect(invite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "초대 링크 생성" }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(invite.mock.calls[0][1]).toMatchObject({
      email: "kim@partner.com",
      name: "김협력",
      projectId: 1,
      role: "REQUESTER",
      externalDomainConfirmed: true,
    });
    await waitFor(() => expect(lastToast()).toBe("초대 링크를 생성했습니다. 사용자 관리의 발송 대기함에서 확인하세요"));
  });

  it("treats the server's EXTERNAL_DOMAIN_CONFIRM_REQUIRED as the confirmation step", async () => {
    const invite = vi
      .spyOn(memberApi, "invite")
      .mockRejectedValueOnce(
        new ApiError(409, { code: "EXTERNAL_DOMAIN_CONFIRM_REQUIRED", message: "회사 도메인과 다른 이메일입니다. 다시 누르면 초대됩니다" }),
      )
      .mockResolvedValueOnce(member(21, []));
    open();
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "lee@hanbitcard.co.kr" } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: "이" } });
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 생성" }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(invite.mock.calls[0][1].externalDomainConfirmed).toBe(false);
    await waitFor(() => expect(lastToast()).toMatch(/다시 누르면 초대됩니다/));
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 생성" }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(2));
    expect(invite.mock.calls[1][1].externalDomainConfirmed).toBe(true);
  });

  it("shows server field errors under the field", async () => {
    vi.spyOn(memberApi, "invite").mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "이메일 형식을 확인하세요",
        fieldErrors: [{ field: "email", message: "이메일 형식을 확인하세요" }],
      }),
    );
    open();
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "a@hanbitcard.co.kr" } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: "가" } });
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 생성" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "이메일 형식을 확인하세요");
  });
});

describe("ChangeEmailDialog", () => {
  const customer = { id: 1, domain: "hanbitcard.co.kr" };
  const open = () => wrap(<ChangeEmailDialog open onClose={vi.fn()} customer={customer} member={member(7, [])} />);

  it("asks once with the email-change wording (not the invitation's), then saves confirmed", async () => {
    const change = vi.spyOn(memberApi, "changeEmail").mockResolvedValue(member(7, []));
    open();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Seven@Partner.com" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(lastToast()).toBe("회사 도메인이 아닌 이메일입니다. 확인 후 다시 저장하세요"));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith(1, 7, "seven@partner.com", true));
  });

  it("shows the server's 409 message and treats it as the confirmation step", async () => {
    const change = vi
      .spyOn(memberApi, "changeEmail")
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: "EXTERNAL_DOMAIN_CONFIRM_REQUIRED",
          message: "회사 도메인이 아닌 이메일입니다. 확인 후 다시 저장하세요",
        }),
      )
      .mockResolvedValueOnce(member(7, []));
    open();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new7@hanbitcard.co.kr" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
    expect(change.mock.calls[0][3]).toBe(false);
    await waitFor(() => expect(lastToast()).toBe("회사 도메인이 아닌 이메일입니다. 확인 후 다시 저장하세요"));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2));
    expect(change.mock.calls[1][3]).toBe(true);
  });
});

describe("RoleEditDialog", () => {
  it("disables requester while reviewer is checked (and back) and keeps the lead's reviewer", async () => {
    const save = vi.spyOn(memberApi, "setProjectRoles").mockResolvedValue(member(2, []));
    const m = member(3, [{ projectId: 1, roles: ["REVIEWER"], lead: true }]);
    wrap(
      <RoleEditDialog open onClose={vi.fn()} customer={{ id: 1, approvalEnabled: false }} projects={projects} member={m} />,
    );
    const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
    expect(box("카드 혜택 알림 요청자").disabled).toBe(true);
    expect(box("카드 혜택 알림 검수자").disabled).toBe(true); // lead
    expect(box("카드 혜택 알림 승인자").disabled).toBe(true); // approval not used
    const row = screen.getByRole("row", { name: /카드 혜택 알림/ });
    expect(within(row).getByText("예")).toBeTruthy();

    fireEvent.click(box("리스크 고지 문자 검수자"));
    expect(box("리스크 고지 문자 요청자").disabled).toBe(true);
    fireEvent.click(box("리스크 고지 문자 검수자"));
    expect(box("리스크 고지 문자 요청자").disabled).toBe(false);
    fireEvent.click(box("리스크 고지 문자 요청자"));
    expect(box("리스크 고지 문자 검수자").disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(1, 3, [{ projectId: 2, roles: ["REQUESTER"] }]));
  });

  it("keeps the modal open with the server refusal", async () => {
    vi.spyOn(memberApi, "setProjectRoles").mockRejectedValue(
      new ApiError(400, { code: "VALIDATION_FAILED", message: "카드 혜택 알림: 마지막 승인자라 해제할 수 없습니다" }),
    );
    const m = member(4, [{ projectId: 1, roles: ["APPROVER"], lead: false }]);
    wrap(<RoleEditDialog open onClose={vi.fn()} customer={{ id: 1, approvalEnabled: true }} projects={projects} member={m} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "카드 혜택 알림 승인자" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect((await screen.findByRole("alert")).textContent).toContain("마지막 승인자라 해제할 수 없습니다");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("DeactivateUserDialog", () => {
  const impact = (patch: Partial<DeactivationImpact> = {}): DeactivationImpact => ({
    reviewing: [],
    requesting: [],
    leadProjects: [],
    lastApproverProjects: [],
    lastAdmin: false,
    ...patch,
  });
  const target = member(6, [{ projectId: 1, roles: ["REVIEWER"], lead: false }]);
  const members = [target, member(2, [{ projectId: 1, roles: ["REVIEWER"], lead: false }]), member(1, [{ projectId: 1, roles: ["REQUESTER"], lead: false }])];
  const open = (i: DeactivationImpact) =>
    wrap(<DeactivateUserDialog open onClose={vi.fn()} customerId={1} member={target} impact={i} members={members} />);

  it("without handover: impact rows only, deactivates with no substitute", async () => {
    const deactivate = vi.spyOn(memberApi, "deactivate").mockResolvedValue(undefined);
    open(impact());
    expect(screen.getByRole("heading", { name: "사용자6 비활성화" })).toBeTruthy();
    expect(screen.getAllByText("없음")).toHaveLength(3);
    expect(screen.queryByLabelText(/대체자/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith(1, 6, { substituteUserId: null, handover: "" }));
  });

  it("with handover: requires substitute (reviewers only) and the note", async () => {
    const deactivate = vi.spyOn(memberApi, "deactivate").mockResolvedValue(undefined);
    const review = { id: "REQ-1", status: "IN_REVIEW", requesterId: 1, projectId: 1 } as DeactivationImpact["reviewing"][number];
    open(impact({ reviewing: [review], leadProjects: [projects[0]] }));
    expect(screen.getByText("REQ-1")).toBeTruthy();
    expect(screen.getByText("카드 혜택 알림")).toBeTruthy();
    const select = screen.getByLabelText(/대체자/);
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["선택", "사용자2"]);
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    await waitFor(() => expect(lastToast()).toBe("대체자을(를) 입력하세요"));
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/인수인계 내용/), { target: { value: "C1 검토 중" } });
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith(1, 6, { substituteUserId: 2, handover: "C1 검토 중" }));
  });

  it("shows blockers before confirming and the server's details after a refusal", async () => {
    vi.spyOn(memberApi, "deactivate").mockRejectedValue(
      new ApiError(409, {
        code: "REQUEST_STATE_CONFLICT",
        message: "요청자로 진행 중인 요청이 1건 있습니다.",
        details: ["REQ-9 카드 혜택 알림"],
      }),
    );
    const waiting = { id: "REQ-9", status: "WAITING", requesterId: 6, projectId: 1 } as DeactivationImpact["requesting"][number];
    open(impact({ requesting: [waiting], lastAdmin: true }));
    expect(screen.getByText("요청자로 진행 중")).toBeTruthy();
    expect(screen.getByText("마지막 고객사 관리자")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("요청자로 진행 중인 요청이 1건 있습니다.");
    expect(within(alert).getByText("REQ-9 카드 혜택 알림")).toBeTruthy();
  });
});

describe("Notice edit and withdraw", () => {
  const notice: Notice = {
    id: 5,
    scope: "PROJECT",
    customerId: 1,
    projectId: 2,
    title: "점검 안내",
    body: "본문",
    authorId: 11,
    createdAt: "2026-10-05T00:00:00Z",
    edited: false,
    withdrawn: false,
    logs: [],
  };
  const customer = { id: 1, name: "한빛카드" };

  it("creates a project notice and switches to the customer scope note", async () => {
    const create = vi.spyOn(noticeApi, "create").mockResolvedValue(notice);
    wrap(<NoticeEditDialog open onClose={vi.fn()} customer={customer} projects={projects} currentProjectId={1} notice={null} />);
    fireEvent.click(screen.getByRole("button", { name: "게시" }));
    await waitFor(() => expect(lastToast()).toBe("제목을(를) 입력하세요"));
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "새 공지" } });
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: "안내합니다" } });
    fireEvent.change(screen.getByLabelText("공지 범위"), { target: { value: "CUSTOMER" } });
    expect(screen.getByText("고객사 전체 구성원에게 보이며 프로젝트나 역할로 거르지 않습니다.")).toBeTruthy();
    expect(screen.queryByLabelText("프로젝트")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "게시" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(1, { scope: "CUSTOMER", projectId: null, title: "새 공지", body: "안내합니다" }),
    );
    await waitFor(() => expect(lastToast()).toBe("공지를 게시했습니다"));
  });

  it("edits with the notice's values and reports the kept history", async () => {
    const update = vi.spyOn(noticeApi, "update").mockResolvedValue({ ...notice, edited: true });
    wrap(<NoticeEditDialog open onClose={vi.fn()} customer={customer} projects={projects} currentProjectId={1} notice={notice} />);
    expect((screen.getByLabelText("프로젝트") as HTMLSelectElement).value).toBe("2");
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "점검 안내 (수정)" } });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(5, { scope: "PROJECT", projectId: 2, title: "점검 안내 (수정)", body: "본문" }),
    );
    await waitFor(() => expect(lastToast()).toBe("공지를 수정했습니다. 이전 내용은 이력으로 남습니다"));
  });

  it("withdraws after confirmation; a refusal keeps the dialog", async () => {
    const withdraw = vi
      .spyOn(noticeApi, "withdraw")
      .mockRejectedValueOnce(new ApiError(409, { code: "REQUEST_STATE_CONFLICT", message: "철회된 공지는 수정하거나 다시 철회할 수 없습니다" }))
      .mockResolvedValueOnce({ ...notice, withdrawn: true });
    const onClose = vi.fn();
    wrap(<WithdrawNoticeDialog notice={notice} onClose={onClose} />);
    expect(screen.getByText("목록과 알림에서 사라지고 철회 이력은 남습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "철회" }));
    await waitFor(() => expect(lastToast()).toBe("철회된 공지는 수정하거나 다시 철회할 수 없습니다"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "철회" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(withdraw).toHaveBeenCalledTimes(2);
  });
});
