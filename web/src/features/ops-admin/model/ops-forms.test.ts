import { describe, expect, it } from "vitest";
import type { OpsTodo } from "@/entities/ops";
import {
  customerBody,
  customerFormProblem,
  deactivateProblem,
  domainPreview,
  isDomainFormat,
  normalizeDomain,
} from "./customer-form";
import { parseRulesJson, xlsxFileProblem } from "./dataset-form";
import { opsInviteStep, type OpsInviteForm } from "./invite-form";
import { decodeOpsIntent, encodeOpsIntent, todoTarget } from "./ops-intent";
import { firstProblem, normalizeTemplates, sameTemplates, templateProblems } from "./template-form";

const existing = [{ name: "한빛카드", domain: "hanbitcard.co.kr" }];

describe("customer create (reference opsCustNew, contract §12)", () => {
  it("normalises the domain like the server and shows the stored value", () => {
    expect(normalizeDomain("  @Saebom.CO.KR ")).toBe("saebom.co.kr");
    expect(domainPreview("@Saebom.CO.KR")).toBe("저장 값: saebom.co.kr");
    expect(domainPreview("saebom.co.kr")).toBeNull();
    expect(domainPreview("")).toBeNull();
  });

  it("checks name, domain, format and duplicates in order", () => {
    const form = { name: "", domain: "", approvalEnabled: false };
    expect(customerFormProblem(form, existing)).toEqual({ message: "고객사 이름을(를) 입력하세요", field: "name" });
    expect(customerFormProblem({ ...form, name: "새봄은행" }, existing)).toEqual({
      message: "회사 도메인을(를) 입력하세요",
      field: "domain",
    });
    expect(customerFormProblem({ ...form, name: "새봄은행", domain: "saebom" }, existing)?.message).toBe(
      "도메인 형식을 확인하세요",
    );
    expect(customerFormProblem({ ...form, name: "새봄은행", domain: "@HanbitCard.co.kr" }, existing)?.message).toBe(
      "한빛카드이(가) 같은 도메인을 쓰고 있습니다",
    );
    expect(customerFormProblem({ ...form, name: "새봄은행", domain: "@Saebom.co.kr" }, existing)).toBeNull();
  });

  it("extracts the host name from pasted addresses, emails and Korean domains like the server", () => {
    expect(normalizeDomain("admin@TagoPlus.co.kr")).toBe("tagoplus.co.kr");
    expect(normalizeDomain("https://www.tagoplus.co.kr:8080/login?x=1")).toBe("tagoplus.co.kr");
    expect(normalizeDomain("http://tagoplus.co.kr/")).toBe("tagoplus.co.kr");
    expect(normalizeDomain("tagoplus.co.kr.")).toBe("tagoplus.co.kr");
    expect(normalizeDomain("txtms.tagoplus.co.kr")).toBe("txtms.tagoplus.co.kr");
    expect(normalizeDomain("예시.com")).toBe("xn--vv4b11d.com");
    expect(normalizeDomain("회사.한국")).toBe("xn--vf4b131b.xn--3e0b707e");
    expect(normalizeDomain("https://")).toBe("");
    for (const ok of ["admin@TagoPlus.co.kr", "https://www.tagoplus.co.kr/", "예시.com", "회사.한국"]) {
      expect(isDomainFormat(normalizeDomain(ok))).toBe(true);
    }
    expect(customerFormProblem({ name: "타고", domain: "https://tagoplus.co.kr/", approvalEnabled: false }, existing)).toBeNull();
  });

  it("follows the API host name rule (labels, final label of letters)", () => {
    expect(isDomainFormat("a-b.example.com")).toBe(true);
    expect(isDomainFormat("-ab.example.com")).toBe(false);
    expect(isDomainFormat("example.c0m")).toBe(false);
    expect(isDomainFormat("example.k")).toBe(false);
  });

  it("sends the trimmed name and normalised domain", () => {
    expect(customerBody({ name: " 새봄은행 ", domain: "@SAEBOM.co.kr", approvalEnabled: true })).toEqual({
      name: "새봄은행",
      domain: "saebom.co.kr",
      approvalEnabled: true,
    });
  });

  it("requires a deactivation reason, then refuses while requests are in progress", () => {
    expect(deactivateProblem(" ", 0)).toBe("비활성 사유을(를) 입력하세요");
    expect(deactivateProblem("계약 종료", 2)).toBe("진행 중 요청 2건을 먼저 정리하거나 담당자와 합의해야 합니다");
    expect(deactivateProblem("계약 종료", 0)).toBeNull();
  });
});

describe("operator invitation (J:216 + J:289)", () => {
  const form: OpsInviteForm = { email: "Admin@Partner.com", name: "관리자", dept: "", projectId: "", role: "REQUESTER" };

  it("asks once for an external address, then sends the first admin without a project", () => {
    const ask = opsInviteStep(form, { domain: "saebom.co.kr", admin: true }, "");
    expect(ask).toMatchObject({ kind: "ask", confirmedEmail: "admin@partner.com" });
    expect(opsInviteStep(form, { domain: "saebom.co.kr", admin: true }, "admin@partner.com")).toEqual({
      kind: "send",
      body: {
        email: "admin@partner.com",
        name: "관리자",
        dept: "",
        admin: true,
        projectId: null,
        role: null,
        externalDomainConfirmed: true,
      },
    });
  });

  it("needs a project for business users and checks the format", () => {
    const company = { ...form, email: "lee@saebom.co.kr" };
    expect(opsInviteStep(company, { domain: "saebom.co.kr", admin: false }, "")).toEqual({
      kind: "invalid",
      message: "프로젝트가 필요합니다",
    });
    expect(opsInviteStep({ ...company, projectId: "7", role: "REVIEWER" }, { domain: "saebom.co.kr", admin: false }, ""))
      .toMatchObject({ kind: "send", body: { projectId: 7, role: "REVIEWER", admin: false, externalDomainConfirmed: false } });
    expect(opsInviteStep({ ...company, email: "lee@" }, { domain: "x.com", admin: true }, "lee@")).toEqual({
      kind: "invalid",
      message: "이메일 형식 또는 중복을 확인하세요",
    });
    expect(opsInviteStep({ ...company, name: " " }, { domain: "saebom.co.kr", admin: true }, "")).toEqual({
      kind: "invalid",
      message: "이름을(를) 입력하세요",
    });
  });
});

describe("알림톡 template editor (contract §12 PUT templates)", () => {
  it("reports problems keyed like the API fieldErrors", () => {
    const problems = templateProblems({
      templates: [
        { code: "HB_POINT_01", name: "포인트" },
        { code: "hb_point_01", name: "중복" },
        { code: "한글코드", name: "" },
        { code: "", name: "이름" },
      ],
    });
    expect(problems).toEqual({
      "templates.1.code": "템플릿 코드 hb_point_01이(가) 중복됩니다",
      "templates.2.code": "템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다",
      "templates.2.name": "템플릿 이름을 입력하세요",
      "templates.3.code": "템플릿 코드를 입력하세요",
    });
    expect(firstProblem(problems)).toBe("템플릿 코드 hb_point_01이(가) 중복됩니다");
  });

  it("limits code and name length and the number of templates", () => {
    expect(templateProblems({ templates: [] })).toEqual({});
    expect(templateProblems({ templates: [{ code: "A".repeat(51), name: "x".repeat(101) }] })).toEqual({
      "templates.0.code": "템플릿 코드는 최대 50자입니다",
      "templates.0.name": "템플릿 이름은 최대 100자입니다",
    });
    const many = Array.from({ length: 101 }, (_, i) => ({ code: `T${i}`, name: "안내" }));
    expect(templateProblems({ templates: many })).toEqual({ templates: "템플릿은 최대 100개입니다" });
  });

  it("trims values and compares lists in order", () => {
    const next = normalizeTemplates({ templates: [{ code: " A1 ", name: " 안내 " }] });
    expect(next).toEqual({ templates: [{ code: "A1", name: "안내" }] });
    expect(sameTemplates(next.templates, [{ code: "A1", name: "안내" }])).toBe(true);
    expect(
      sameTemplates(
        [
          { code: "A", name: "a" },
          { code: "B", name: "b" },
        ],
        [
          { code: "B", name: "b" },
          { code: "A", name: "a" },
        ],
      ),
    ).toBe(false);
  });
});

describe("dataset registration input", () => {
  it("parses a JSON rule array (camelCase or the XLSX column names)", () => {
    expect(parseRulesJson('[{"ruleId":"R1","originalExpr":"되요","recommendedExpr":"돼요"}]')).toEqual({
      rules: [{ ruleId: "R1", originalExpr: "되요", recommendedExpr: "돼요" }],
    });
    expect(parseRulesJson('[{"rule_id":"R2","original_pattern":"(\\\\d+)원","recommended_pattern":"$1 원","x":1}]')).toEqual({
      rules: [{ ruleId: "R2", originalPattern: "(\\d+)원", recommendedPattern: "$1 원" }],
    });
  });

  it("refuses what is not a non-empty array of objects", () => {
    expect(parseRulesJson("")).toEqual({ error: "규칙 JSON 배열을(를) 입력하세요" });
    expect(parseRulesJson("{}")).toEqual({ error: "규칙 배열을 입력하세요" });
    expect(parseRulesJson("[]")).toEqual({ error: "규칙 배열을 입력하세요" });
    expect(parseRulesJson("[1]")).toEqual({ error: "규칙은 객체로 입력하세요" });
    expect("error" in parseRulesJson("[{")).toBe(true);
    expect((parseRulesJson("[{") as { error: string }).error).toMatch(/^JSON 형식을 확인하세요/);
  });

  it("checks the workbook before upload", () => {
    expect(xlsxFileProblem(null)).toBe("파일을 선택하세요");
    expect(xlsxFileProblem(new File(["a"], "rules.csv"))).toBe("XLSX 파일만 등록할 수 있습니다");
    expect(xlsxFileProblem(new File(["a"], "rules.xlsx"))).toBeNull();
  });
});

describe("operator hand-offs", () => {
  const todo: OpsTodo = {
    kind: "ASSIGN_DATASETS",
    label: "유효 데이터셋 1개 조합 배정",
    route: "opsStandards",
    sub: "assign",
    customerId: 2,
    customerName: "도담생명",
    customerDomain: "dodamlife.com",
    approvalEnabled: false,
    count: 1,
  };

  it("maps a todo to its tab and the customer / sub tab to select", () => {
    expect(todoTarget(todo)).toEqual({
      ref: { route: "opsStandards", params: {} },
      view: "opsStandards",
      intent: { customerId: 2, sub: "assign" },
    });
    expect(todoTarget({ ...todo, kind: "INVITE_ADMIN", route: "opsSetup", sub: null })).toEqual({
      ref: { route: "opsSetup", params: {} },
      view: "opsSetup",
      intent: { customerId: 2 },
    });
    expect(todoTarget({ ...todo, route: "unknown" })).toBeNull();
  });

  it("round-trips the intent payload and ignores garbage", () => {
    expect(decodeOpsIntent(encodeOpsIntent({ customerId: 3, sub: "types" }))).toEqual({ customerId: 3, sub: "types" });
    expect(decodeOpsIntent("not json")).toBeNull();
    expect(decodeOpsIntent(undefined)).toBeNull();
  });
});
