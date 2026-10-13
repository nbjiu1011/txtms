import { fireEvent, render, screen } from "@testing-library/react";
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

function renderTable(members: Member[], onOpen = vi.fn()) {
  return render(
    <UsersTable
      members={members}
      projects={[]}
      busyId={null}
      onRoles={vi.fn()}
      onEmail={vi.fn()}
      onDeactivate={vi.fn()}
      onReactivate={vi.fn()}
      onReissue={vi.fn()}
      onOpen={onOpen}
    />,
  );
}

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

  it("opens the user's detail from the name", () => {
    const onOpen = vi.fn();
    const m = member(1);
    renderTable([m], onOpen);
    fireEvent.click(screen.getByRole("button", { name: "사용자1 상세 보기" }));
    expect(onOpen).toHaveBeenCalledWith(m);
  });
});
