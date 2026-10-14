import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { auditKeys, type OutboxMail } from "@/entities/audit";
import { OutboxPanel } from "./outbox-panel";

const mail = (id: number, patch: Partial<OutboxMail> = {}): OutboxMail => ({
  id,
  customerId: 1,
  to: `u${id}@hanbitcard.co.kr`,
  subject: "TX TMS 초대",
  body: `초대 링크: https://tms.example/invite/token-${id}`,
  createdAt: "2026-10-05T01:00:00Z",
  status: "PENDING",
  sentAt: null,
  masked: false,
  kind: "INVITATION",
  ...patch,
});

function setup(mails: OutboxMail[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(auditKeys.outbox(1, 0, 20), {
    content: mails,
    page: { number: 0, size: 20, totalElements: mails.length, totalPages: mails.length ? 1 : 0 },
  });
  render(
    <QueryClientProvider client={client}>
      <OutboxPanel customerId={1} />
    </QueryClientProvider>,
  );
}

describe("OutboxPanel", () => {
  it("lists the mails as rows and opens the body from the subject or a row click", () => {
    setup([mail(1), mail(2, { masked: true, body: "초대 링크: https://tms.example/invite/••••" })]);
    const outbox = within(screen.getByRole("region", { name: "메일 발송 대기함" }));
    expect(outbox.queryByText(/token-1/)).toBeNull();
    const row = outbox.getByRole("row", { name: /u2@hanbitcard.co.kr/ });
    expect(within(row).getByText("초대")).toBeTruthy();
    expect(within(row).getByText("링크 가림")).toBeTruthy();

    fireEvent.click(outbox.getByRole("button", { name: "TX TMS 초대 · u1@hanbitcard.co.kr 메일 보기" }));
    const dialog = screen.getByRole("dialog", { name: "TX TMS 초대" });
    expect(within(dialog).getByText(/token-1/)).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "닫기" })[0]);

    fireEvent.click(within(row).getAllByRole("cell")[1]);
    expect(within(screen.getByRole("dialog", { name: "TX TMS 초대" })).getByText(/••••/)).toBeTruthy();
  });

  it("says what fills the outbox when it is empty", () => {
    setup([]);
    expect(screen.getByText("발송 대기 메일이 없습니다")).toBeTruthy();
  });
});
