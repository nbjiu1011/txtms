import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Member } from "@/entities/user";
import { UsersTable } from "./users-table";

const member = (id: number, patch: Partial<Member> = {}): Member => ({
  user: { id, name: `사용자${id}`, dept: "팀", email: `u${id}@hanbitcard.co.kr`, active: true, avatarColor: "#000" },
  pending: false,
  admin: false,
  projects: [],
  invitationExpiresAt: null,
  pendingEmail: null,
  ...patch,
});

function renderTable(members: Member[], onOpen = vi.fn(), onRoles = vi.fn(), onReissue = vi.fn()) {
  return render(
    <UsersTable members={members} projects={[]} busyId={null} onRoles={onRoles} onReissue={onReissue} onOpen={onOpen} />,
  );
}

const rowOf = (name: string) =>
  screen.getByRole("button", { name: `${name} 상세 보기` }).closest('[role="row"]') as HTMLElement;

describe("UsersTable", () => {
  it("shows the address awaiting confirmation under the current email", () => {
    renderTable([member(1, { pendingEmail: "new1@hanbitcard.co.kr" }), member(2)]);
    expect(screen.getByText("u1@hanbitcard.co.kr")).toBeTruthy();
    expect(screen.getByText("변경 확인 대기: new1@hanbitcard.co.kr")).toBeTruthy();
    expect(screen.getAllByText(/변경 확인 대기/)).toHaveLength(1);
  });

  it("shows nothing extra without a waiting change", () => {
    renderTable([member(3)]);
    expect(screen.queryByText(/변경 확인 대기/)).toBeNull();
  });

  it("opens the user's detail from the name and from a row click", () => {
    const onOpen = vi.fn();
    const m = member(1);
    renderTable([m], onOpen);
    fireEvent.click(screen.getByRole("button", { name: "사용자1 상세 보기" }));
    expect(onOpen).toHaveBeenCalledWith(m);
    fireEvent.click(within(rowOf("사용자1")).getAllByRole("cell")[1]);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("keeps one row action: 역할, or 초대 재발급 for an invitation", () => {
    const onOpen = vi.fn();
    const onRoles = vi.fn();
    const onReissue = vi.fn();
    const invited = member(2, { pending: true, user: { ...member(2).user, dept: null, active: false } });
    renderTable([member(1), invited], onOpen, onRoles, onReissue);
    const accepted = within(rowOf("사용자1"));
    expect(accepted.getAllByRole("button").map((b) => b.textContent)).toEqual(["사용자1", "역할"]);
    fireEvent.click(accepted.getByRole("button", { name: "사용자1 역할" }));
    expect(onRoles).toHaveBeenCalledTimes(1);
    const pending = within(rowOf("사용자2"));
    expect(pending.getAllByText("초대 대기")).toHaveLength(2); // 소속 and 상태
    fireEvent.click(pending.getByRole("button", { name: "초대 재발급" }));
    expect(onReissue).toHaveBeenCalledTimes(1);
    // the action buttons do not open the row
    expect(onOpen).not.toHaveBeenCalled();
  });
});
