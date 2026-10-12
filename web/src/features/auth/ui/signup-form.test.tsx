import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import type { AuthSession, SignupCustomer } from "@/entities/me";
import { authApi } from "../api/auth-api";
import { SignupForm } from "./signup-form";

const customers: SignupCustomer[] = [
  { id: 1, name: "한빛카드", approvalEnabled: true, projects: [{ id: 10, name: "카드 혜택 알림", leadName: "박지훈" }] },
  { id: 2, name: "도담생명", approvalEnabled: false, projects: [{ id: 20, name: "계약 유지 안내", leadName: null }] },
];

const session = {
  accessToken: "token",
  me: {
    id: 99,
    name: "홍길동",
    dept: null,
    email: "gil@example.com",
    customerId: 1,
    operator: false,
    adminCustomerIds: [],
    avatarColor: "#3C6E71",
    demo: false,
    memberships: [{ projectId: 10, customerId: 1, roles: ["REVIEWER"], lead: true }],
    session: { remember: false, expiresAt: "2026-10-12T05:00:00Z" },
  },
} as unknown as AuthSession;

const alerts = () => screen.queryAllByRole("alert").map((el) => el.textContent);
const lastToast = () => useToastStore.getState().message;

function account(name = "홍길동", email = "Gil@Example.com", password = "Signup!2026") {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: password } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "가입하고 시작하기" }));

afterEach(() => {
  vi.restoreAllMocks();
  useToastStore.getState().dismiss();
});

describe("SignupForm", () => {
  it("asks for a role first and shows the scope fields the role needs", async () => {
    const signup = vi.spyOn(authApi, "signup");
    render(<SignupForm customers={customers} onSuccess={() => {}} />);
    expect(screen.queryByLabelText("고객사")).toBeNull();

    account();
    submit();
    await waitFor(() => expect(alerts()).toEqual(["역할을 선택하세요"]));

    fireEvent.click(screen.getByLabelText(/고객사 관리자/));
    expect(screen.getByLabelText("고객사")).toBeTruthy();
    expect(screen.queryByLabelText("프로젝트")).toBeNull();

    fireEvent.click(screen.getByLabelText(/솔루션 운영 담당자/));
    expect(screen.queryByLabelText("고객사")).toBeNull();

    fireEvent.click(screen.getByLabelText(/요청자/));
    submit();
    await waitFor(() => expect(alerts()).toEqual(["고객사를 선택하세요"]));
    expect(signup).not.toHaveBeenCalled();
  });

  it("warns that a lead reviewer sign-up takes over the project, then sends the contract body", async () => {
    const signup = vi.spyOn(authApi, "signup").mockResolvedValue(session);
    const onSuccess = vi.fn();
    render(<SignupForm customers={customers} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByLabelText(/대표 검수자/));
    fireEvent.change(screen.getByLabelText("고객사"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("프로젝트"), { target: { value: "10" } });
    expect(screen.getByText(/박지훈에서 가입자로 바뀝니다/)).toBeTruthy();

    account();
    submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("홍길동"));
    expect(signup).toHaveBeenCalledWith({
      name: "홍길동",
      email: "gil@example.com",
      password: "Signup!2026",
      role: "LEAD_REVIEWER",
      customerId: 1,
      projectId: 10,
    });
  });

  it("refuses an approver for a customer without the approval step", async () => {
    const signup = vi.spyOn(authApi, "signup");
    render(<SignupForm customers={customers} onSuccess={() => {}} />);
    fireEvent.click(screen.getByLabelText(/승인자/));
    fireEvent.change(screen.getByLabelText("고객사"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("프로젝트"), { target: { value: "20" } });
    account();
    submit();
    await waitFor(() => expect(alerts()).toContain("이 고객사는 승인 단계를 쓰지 않습니다"));
    expect(signup).not.toHaveBeenCalled();
  });

  it("puts a duplicate email under the email field", async () => {
    vi.spyOn(authApi, "signup").mockRejectedValue(
      new ApiError(409, { code: "DUPLICATE", message: "이미 가입된 이메일입니다" }),
    );
    const onSuccess = vi.fn();
    render(<SignupForm customers={customers} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByLabelText(/솔루션 운영 담당자/));
    account();
    submit();
    await waitFor(() => expect(alerts()).toEqual(["이미 가입된 이메일입니다"]));
    expect(lastToast()).toBe("이미 가입된 이메일입니다");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
