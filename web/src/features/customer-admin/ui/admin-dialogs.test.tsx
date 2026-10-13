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
import { chooseValue, optionLabels, selectValue } from "@/shared/common/testing";

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
  pendingEmail: null,
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
    expect(optionLabels(screen.getByLabelText("역할"))).toContain("승인자");

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

  it("tells that an accepted user's change waits for the link mailed to the new address", async () => {
    const change = vi.spyOn(memberApi, "changeEmail").mockResolvedValue(member(7, [], { pendingEmail: "n@x.kr" }));
    const onClose = vi.fn();
    wrap(<ChangeEmailDialog open onClose={onClose} customer={customer} member={member(7, [])} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new7@hanbitcard.co.kr" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith(1, 7, "new7@hanbitcard.co.kr", false));
    await waitFor(() => expect(lastToast()).toBe("새 주소로 확인 메일을 보냈습니다. 사용자가 확인하면 변경됩니다"));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the pending user's immediate change without the confirmation wording", async () => {
    const pending = member(8, [], { pending: true });
    const change = vi.spyOn(memberApi, "changeEmail").mockResolvedValue(pending);
    const onClose = vi.fn();
    wrap(<ChangeEmailDialog open onClose={onClose} customer={customer} member={pending} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "new8@hanbitcard.co.kr" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastToast()).not.toBe("새 주소로 확인 메일을 보냈습니다. 사용자가 확인하면 변경됩니다");
  });

  it("shows the change awaiting confirmation and cancels it with the current address", async () => {
    const waiting = member(9, [], { pendingEmail: "nine@hanbitcard.co.kr" });
    const change = vi.spyOn(memberApi, "changeEmail").mockResolvedValue(member(9, []));
    wrap(<ChangeEmailDialog open onClose={vi.fn()} customer={customer} member={waiting} />);
    expect(screen.getByText(/변경 확인 대기: nine@hanbitcard.co.kr/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith(1, 9, "u9@hanbitcard.co.kr", false));
    await waitFor(() => expect(lastToast()).toBe("대기 중인 이메일 변경을 취소했습니다"));
  });

  it("does not call the API for the current address without a waiting change", async () => {
    const change = vi.spyOn(memberApi, "changeEmail").mockResolvedValue(member(7, []));
    const onClose = vi.fn();
    wrap(<ChangeEmailDialog open onClose={onClose} customer={customer} member={member(7, [])} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(change).not.toHaveBeenCalled();
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
  const target = member(6, [{ projectId: 1, roles: ["REVIEWER"], lead: false }]);
  // the server's candidates: usable reviewers other than the target
  const substitutes = [member(2, [{ projectId: 1, roles: ["REVIEWER"], lead: false }])];
  const impact = (patch: Partial<DeactivationImpact> = {}): DeactivationImpact => ({
    reviewing: [],
    requesting: [],
    leadProjects: [],
    lastApproverProjects: [],
    lastAdmin: false,
    substitutes,
    ...patch,
  });
  const open = (i: DeactivationImpact) =>
    wrap(<DeactivateUserDialog open onClose={vi.fn()} customerId={1} member={target} impact={i} />);

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
    expect(optionLabels(select)).toEqual(["선택", "사용자2"]);
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    await waitFor(() => expect(lastToast()).toBe("대체자을(를) 입력하세요"));
    chooseValue(select, "2");
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

// The rich text editor (Quill) mounts asynchronously: allow for a loaded machine when the whole suite runs.
describe("Notice edit and withdraw", { timeout: 20_000 }, () => {
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
    // the rich text editor's empty document is no content
    const editor = await screen.findByRole("textbox", { name: "내용" });
    fireEvent.click(screen.getByRole("button", { name: "게시" }));
    await waitFor(() => expect(lastToast()).toBe("내용을(를) 입력하세요"));
    editor.innerHTML = "<p>안내합니다</p>";
    // the editor reports changes from a MutationObserver; Quill drops `ql-blank` in the same update
    await waitFor(() => expect(editor.classList.contains("ql-blank")).toBe(false));
    chooseValue(screen.getByLabelText("공지 범위"), "CUSTOMER");
    expect(screen.getByText("고객사 전체 구성원에게 보이며 프로젝트나 역할로 거르지 않습니다.")).toBeTruthy();
    expect(screen.queryByLabelText("프로젝트")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "게시" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(1, { scope: "CUSTOMER", projectId: null, title: "새 공지", body: "<p>안내합니다</p>" }),
    );
    await waitFor(() => expect(lastToast()).toBe("공지를 게시했습니다"));
  });

  it("edits with the notice's values and reports the kept history", async () => {
    const update = vi.spyOn(noticeApi, "update").mockResolvedValue({ ...notice, edited: true });
    wrap(<NoticeEditDialog open onClose={vi.fn()} customer={customer} projects={projects} currentProjectId={1} notice={notice} />);
    expect(selectValue(screen.getByLabelText("프로젝트"))).toBe("2");
    // a plain-text notice loads as paragraphs; untouched, its body is sent back as it was
    expect((await screen.findByRole("textbox", { name: "내용" })).innerHTML).toBe("<p>본문</p>");
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
