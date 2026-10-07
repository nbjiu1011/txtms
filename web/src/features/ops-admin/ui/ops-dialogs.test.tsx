import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { opsApi, type Dataset, type OpsCustomer } from "@/entities/ops";
import type { Project } from "@/entities/project";
import { CreateCustomerDialog } from "./customer-dialogs";
import { DatasetRegisterDialog } from "./dataset-dialogs";
import { SendingInfoDialog } from "./sending-info-dialog";
import { SeedUserDialog } from "./setup-dialogs";

const lastToast = () => useToastStore.getState().message;

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const dialog = () => screen.getByRole("dialog");
const ok = (label: string) => fireEvent.click(within(dialog()).getByRole("button", { name: label }));

afterEach(() => {
  vi.restoreAllMocks();
  useToastStore.getState().dismiss();
});

const opsCustomer = (patch: Partial<OpsCustomer> = {}): OpsCustomer => ({
  id: 9,
  name: "새봄은행",
  domain: "saebom.co.kr",
  approvalEnabled: false,
  active: true,
  sample: false,
  notifyChannel: "IN_APP",
  dueSoonDays: 3,
  createdAt: "2026-10-07T01:00:00Z",
  createdBy: 5,
  deactivationReason: null,
  projectCount: 1,
  userCount: 0,
  requestCount: 0,
  activeRequestCount: 0,
  completedRequestCount: 0,
  sampleRequestCount: 0,
  admins: [],
  adminAssigned: false,
  unassignedDatasetTypes: ["ALIMTALK", "SMS", "RCS", "FREEFORM"],
  ...patch,
});

describe("CreateCustomerDialog", () => {
  it("shows the normalised domain under the field and refuses a bad or duplicate one", async () => {
    const create = vi.spyOn(opsApi, "createCustomer");
    wrap(
      <CreateCustomerDialog
        open
        onClose={vi.fn()}
        customers={[{ name: "한빛카드", domain: "hanbitcard.co.kr" }]}
        onCreated={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/고객사 이름/), { target: { value: "새봄은행" } });
    const domain = screen.getByLabelText(/회사 도메인/);
    fireEvent.change(domain, { target: { value: " @Saebom.CO.KR" } });
    expect(screen.getByText("저장 값: saebom.co.kr")).toBeTruthy();

    fireEvent.change(domain, { target: { value: "saebom" } });
    ok("생성");
    await waitFor(() => expect(lastToast()).toBe("도메인 형식을 확인하세요"));
    expect(within(dialog()).getByRole("alert").textContent).toBe("도메인 형식을 확인하세요");

    fireEvent.change(domain, { target: { value: "@HANBITCARD.co.kr" } });
    expect(within(dialog()).queryByRole("alert")).toBeNull();
    ok("생성");
    await waitFor(() => expect(lastToast()).toMatch(/^한빛카드이\(가\) 같은 도메인을 쓰고 있습니다/));
    expect(create).not.toHaveBeenCalled();
  });

  it("creates with the normalised body and hands the customer over", async () => {
    const created = opsCustomer();
    const create = vi.spyOn(opsApi, "createCustomer").mockResolvedValue(created);
    const onCreated = vi.fn();
    wrap(<CreateCustomerDialog open onClose={vi.fn()} customers={[]} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/고객사 이름/), { target: { value: " 새봄은행 " } });
    fireEvent.change(screen.getByLabelText(/회사 도메인/), { target: { value: "@Saebom.co.kr " } });
    fireEvent.click(screen.getByRole("checkbox", { name: /승인 단계 사용/ }));
    ok("생성");
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(create).toHaveBeenCalledWith({ name: "새봄은행", domain: "saebom.co.kr", approvalEnabled: true });
    expect(lastToast()).toBe("고객사를 만들었습니다. 초기 설정을 이어서 진행하세요");
  });

  it("puts a server DUPLICATE refusal under the domain field", async () => {
    vi.spyOn(opsApi, "createCustomer").mockRejectedValue(
      new ApiError(409, {
        code: "DUPLICATE",
        message: "도담생명이(가) 같은 도메인을 쓰고 있습니다. 중복 허용 여부는 협의 23 결정 전까지 막습니다",
        fieldErrors: [{ field: "domain", message: "도담생명이(가) 같은 도메인을 쓰고 있습니다. 중복 허용 여부는 협의 23 결정 전까지 막습니다" }],
      }),
    );
    wrap(<CreateCustomerDialog open onClose={vi.fn()} customers={[]} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/고객사 이름/), { target: { value: "도담" } });
    fireEvent.change(screen.getByLabelText(/회사 도메인/), { target: { value: "dodamlife.com" } });
    ok("생성");
    await waitFor(() => expect(within(dialog()).getByRole("alert").textContent).toMatch(/^도담생명이\(가\)/));
  });
});

describe("DatasetRegisterDialog", () => {
  const created: Dataset = { id: 30, scope: "SMS", version: 3, ruleCount: 2, createdAt: "2026-10-07T01:00:00Z", createdBy: 5 };
  const rowErrors = new ApiError(400, {
    code: "VALIDATION_FAILED",
    message: "교정 규칙을 확인하세요",
    details: ["3행: rule_id를 입력하세요", "5행: original_expr와 original_pattern 중 하나만 입력하세요", "외 4건"],
  });

  it("uploads the XLSX with the scope and lists the server's row errors", async () => {
    const upload = vi.spyOn(opsApi, "uploadDataset").mockRejectedValue(rowErrors);
    wrap(<DatasetRegisterDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("유형"), { target: { value: "SMS" } });
    ok("등록");
    await waitFor(() => expect(lastToast()).toBe("파일을 선택하세요"));

    const file = new File(["xlsx"], "rules.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText(/규칙 파일/), { target: { files: [file] } });
    ok("등록");
    await waitFor(() => expect(upload).toHaveBeenCalledWith("SMS", file));
    const alert = await within(dialog()).findByRole("alert");
    expect(within(alert).getByText("교정 규칙을 확인하세요")).toBeTruthy();
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "3행: rule_id를 입력하세요",
      "5행: original_expr와 original_pattern 중 하나만 입력하세요",
      "외 4건",
    ]);
    expect(dialog()).toBeTruthy();
  });

  it("sends a pasted JSON array and closes on success", async () => {
    const createDataset = vi.spyOn(opsApi, "createDataset").mockResolvedValue(created);
    const onClose = vi.fn();
    wrap(<DatasetRegisterDialog open onClose={onClose} initialType="SMS" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON 붙여넣기" }));
    const area = screen.getByLabelText(/규칙 JSON 배열/);
    fireEvent.change(area, { target: { value: "[1]" } });
    ok("등록");
    await waitFor(() => expect(lastToast()).toBe("규칙은 객체로 입력하세요"));
    fireEvent.change(area, { target: { value: '[{"ruleId":"S1","originalExpr":"되요","recommendedExpr":"돼요"}]' } });
    ok("등록");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createDataset).toHaveBeenCalledWith({
      scope: "SMS",
      rules: [{ ruleId: "S1", originalExpr: "되요", recommendedExpr: "돼요" }],
    });
    expect(lastToast()).toBe("문자 v3 데이터셋을 등록했습니다 (규칙 2개)");
  });
});

const project = (patch: Partial<Project> = {}): Project => ({
  id: 4,
  customerId: 9,
  name: "기본 프로젝트",
  active: true,
  leadUserId: null,
  templates: [],
  senders: [],
  members: [],
  variablesRevision: 0,
  ...patch,
});

describe("SendingInfoDialog", () => {
  it("validates rows inline before saving and saves only the changed list", async () => {
    const putTemplates = vi.spyOn(opsApi, "putTemplates").mockResolvedValue(project());
    const putSenders = vi.spyOn(opsApi, "putSenders").mockResolvedValue(project());
    const onClose = vi.fn();
    wrap(<SendingInfoDialog open onClose={onClose} project={project({ senders: ["1588-0000"] })} />);
    fireEvent.click(screen.getByRole("button", { name: "템플릿 추가" }));
    fireEvent.change(screen.getByLabelText("템플릿 1 코드"), { target: { value: "새 코드" } });
    ok("저장");
    await waitFor(() => expect(lastToast()).toBe("템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다"));
    expect(screen.getByText("템플릿 이름을 입력하세요")).toBeTruthy();
    expect(putTemplates).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("템플릿 1 코드"), { target: { value: " SB_NOTICE_01 " } });
    fireEvent.change(screen.getByLabelText("템플릿 1 이름"), { target: { value: "가입 안내" } });
    ok("저장");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putTemplates).toHaveBeenCalledWith(4, [{ code: "SB_NOTICE_01", name: "가입 안내" }]);
    expect(putSenders).not.toHaveBeenCalled();
    expect(lastToast()).toBe("발신 정보를 저장했습니다");
  });

  it("shows a server field error under its row", async () => {
    vi.spyOn(opsApi, "putSenders").mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "발신번호 형식을 확인하세요 (예: 1588-0000, 02-3456-7000)",
        fieldErrors: [{ field: "senders.1", message: "발신번호 형식을 확인하세요 (예: 1588-0000, 02-3456-7000)" }],
      }),
    );
    wrap(<SendingInfoDialog open onClose={vi.fn()} project={project({ senders: ["1588-0000"] })} />);
    fireEvent.click(screen.getByRole("button", { name: "발신번호 추가" }));
    fireEvent.change(screen.getByLabelText("발신번호 2"), { target: { value: "02-345-6789" } });
    ok("저장");
    const row = screen.getByLabelText("발신번호 2").closest("div") as HTMLElement;
    await waitFor(() =>
      expect(within(row).getByRole("alert").textContent).toBe("발신번호 형식을 확인하세요 (예: 1588-0000, 02-3456-7000)"),
    );
  });
});

describe("SeedUserDialog", () => {
  it("asks once for an external first admin, then sends it confirmed and shows the queued mail", async () => {
    const invite = vi.spyOn(opsApi, "invite").mockResolvedValue({} as never);
    vi.spyOn(opsApi, "latestMails").mockResolvedValue({
      content: [
        {
          id: 1,
          customerId: 9,
          to: "boss@partner.com",
          subject: "TX TMS 초대",
          body: "http://localhost:3000/invite/abc",
          createdAt: "2026-10-07T01:00:00Z",
          status: "PENDING",
          masked: false,
        },
      ],
      page: { number: 0, size: 10, totalElements: 1, totalPages: 1 },
    });
    const customer = opsCustomer();
    wrap(<SeedUserDialog open onClose={vi.fn()} customer={customer} mode="admin" projects={[]} />);
    expect(screen.getByRole("dialog", { name: "첫 고객사 관리자 초대" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "Boss@Partner.com" } });
    fireEvent.change(screen.getByLabelText(/^이름/), { target: { value: "대표" } });
    expect(screen.getByText("외부 도메인 이메일입니다. 초대 대상을 확인하세요.")).toBeTruthy();
    ok("초대 링크 생성");
    await waitFor(() => expect(lastToast()).toMatch(/^회사 도메인과 다른 이메일입니다/));
    expect(invite).not.toHaveBeenCalled();
    ok("초대 링크 생성");
    await screen.findByRole("dialog", { name: "초대 링크 생성 완료" });
    expect(invite).toHaveBeenCalledWith(9, expect.objectContaining({ email: "boss@partner.com", admin: true, externalDomainConfirmed: true }));
    expect(screen.getByText("http://localhost:3000/invite/abc")).toBeTruthy();
  });
});
