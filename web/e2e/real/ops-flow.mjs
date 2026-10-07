/**
 * Solution operator (M7) screens against a running API in demo mode.
 *   node e2e/real/ops-flow.mjs            (BASE=http://localhost:3000, API_ORIGIN=http://localhost:8080)
 * 정우진 (u5) reads the ops dashboard, creates a throwaway customer (domain normalisation, format and
 * duplicate refusals), finds its default project in 초기 설정·시드, invites the first admin with the
 * external-domain confirmation and a business user, sets the project's templates and senders, assigns
 * and confirms datasets for all four types (change, unassign, seed), switches a content type off and on
 * again, registers a dataset version (JSON row errors, then the sample XLSX), creates and clears a
 * sample request on 한빛카드, reads 운영 이력 / 설정 이력 / 발송 대기함, cancels the 시연 데이터 초기화
 * modal and deactivates the test customer. Request screens show the operator's no-content state.
 * Data stays in the dev DB: one dataset version is added, the test customer ends inactive, the content
 * type is restored.
 */
import { expect } from "@playwright/test";
import { BASE, apiAs, dialog, log, main, startRun, toastSeen } from "./helpers.mjs";

const OPS = 5;
const XLSX = "E:/workspace/txtms/api/src/main/resources/demo/correction-sample-dataset.xlsx";
const run = await startRun("ops");
const { persona, shot, close } = run;
const stamp = Date.now().toString(36);
const NAME = `E2E운영 ${stamp}`;
const DOMAIN = `ops${stamp}.example.com`;
const ADMIN_EMAIL = `admin.${stamp}@partner-example.com`;
const MEMBER_EMAIL = `member.${stamp}@${DOMAIN}`;
const TEMPLATE = `E2E_${stamp.toUpperCase()}`;
const TYPES = ["ALIMTALK", "SMS", "RCS", "FREEFORM"];
const LABEL = { ALIMTALK: "알림톡", SMS: "문자", RCS: "RCS", FREEFORM: "자유입력형" };

const ops = await persona("u5", "정우진");
const m = () => main(ops);
const go = async (path, heading) => {
  await ops.goto(`${BASE}${path}`);
  await expect(m().getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
};
const datasetsOf = async (type) =>
  (await apiAs(OPS, "GET", "/ops/datasets")).filter((d) => d.scope === type).sort((a, b) => b.version - a.version);
let customerId = 0;
/** Content type states before the run (restored by the cleanup). */
const initialTypes = await apiAs(OPS, "GET", "/ops/content-types");

/** Leaves the shared dev DB as found: the content type restored, the test customer inactive. */
async function cleanup() {
  await new Promise((resolve) => setTimeout(resolve, 1000)); // let a write of the page land first
  const now = await apiAs(OPS, "GET", "/ops/content-types").catch(() => []);
  for (const t of initialTypes) {
    const current = now.find((x) => x.type === t.type);
    if (current && current.active !== t.active) {
      await apiAs(OPS, "PATCH", `/ops/content-types/${t.type}`, { active: t.active }).catch(() => {});
    }
  }
  if (customerId) await apiAs(OPS, "POST", `/ops/customers/${customerId}/deactivate`, { reason: "E2E 정리" }).catch(() => {});
}

/** Step runner that cleans up before the shared runner exits on a failure. */
const step = (name, fn) =>
  run.step(name, async () => {
    try {
      await fn();
    } catch (error) {
      console.log(String(error.message).split("\n").slice(0, 8).join("\n"));
      await cleanup();
      throw error;
    }
  });

try {
  await step("dashboard: three KPIs, no 내 지원 접근, todos and customers", async () => {
    await expect(m().getByRole("heading", { level: 1, name: "정우진님, 운영 현황입니다" })).toBeVisible({ timeout: 20_000 });
    for (const k of ["등록 고객사", "관리자 미지정", "데이터셋 미배정 고객사"]) await expect(m().getByText(k)).toBeVisible();
    await expect(m().getByText("내 지원 접근")).toHaveCount(0);
    await expect(m().getByRole("heading", { name: "초기 설정에서 남은 일" })).toBeVisible();
    await expect(m().getByRole("button", { name: /^한빛카드\s*프로젝트/ })).toBeVisible();
    await expect(ops.getByRole("combobox", { name: "프로젝트" })).toHaveText("참여 프로젝트 없음");
    await shot(ops, "dashboard");
  });

  await step("request screens show the operator's no-content state", async () => {
    await go("/requests", "요청");
    await expect(m().getByText("운영 담당자는 요청을 조회하지 않습니다")).toBeVisible();
    await go("/contents", "콘텐츠");
    await expect(m().getByText("운영 담당자는 콘텐츠를 조회하지 않습니다")).toBeVisible();
  });

  await step("고객사 생성: required, format and duplicate refusals, normalised domain", async () => {
    await go("/", "정우진님, 운영 현황입니다");
    await m().getByRole("button", { name: "고객사 생성" }).click();
    const d = dialog(ops, "고객사 생성");
    await d.getByRole("button", { name: "생성" }).click();
    await toastSeen(ops, "고객사 이름을(를) 입력하세요");
    await d.getByLabel(/고객사 이름/).fill(NAME);
    await d.getByLabel(/회사 도메인/).fill("bad");
    await d.getByRole("button", { name: "생성" }).click();
    await toastSeen(ops, "도메인 형식을 확인하세요");
    await d.getByLabel(/회사 도메인/).fill("@HanbitCard.co.kr");
    await d.getByRole("button", { name: "생성" }).click();
    await toastSeen(ops, "한빛카드이(가) 같은 도메인을 쓰고 있습니다");
    await d.getByLabel(/회사 도메인/).fill(` @${DOMAIN.toUpperCase()}`);
    await expect(d.getByText(`저장 값: ${DOMAIN}`)).toBeVisible();
    await shot(ops, "create-customer");
    await d.getByRole("button", { name: "생성" }).click();
    await toastSeen(ops, "고객사를 만들었습니다. 초기 설정을 이어서 진행하세요");
    await ops.waitForURL(/\/ops\/setup$/);
    customerId = (await apiAs(OPS, "GET", "/ops/customers")).find((c) => c.domain === DOMAIN).id;
    await expect(m().getByRole("combobox", { name: "고객사 선택" })).toHaveValue(String(customerId));
  });

  await step("초기 설정: default project, steps, real customer has no sample actions", async () => {
    await expect(m().getByText("1개 (기본 프로젝트)")).toBeVisible();
    await expect(m().getByText("아직 없습니다. 관리자를 먼저 초대하세요.")).toBeVisible();
    await expect(m().getByRole("row", { name: /^기본 프로젝트/ })).toBeVisible();
    const sample = m().getByRole("region", { name: "샘플 요청·콘텐츠" });
    await expect(sample.getByText(/샘플 데이터 작업은 샘플 고객사에서만 가능합니다/)).toBeVisible();
    await expect(sample.getByRole("button")).toHaveCount(0);
    await expect(m().getByRole("cell", { name: "기본 프로젝트 생성" })).toBeVisible();
    await shot(ops, "setup-new");
  });

  await step("첫 고객사 관리자 초대: external domain needs a second click, result shows the mail", async () => {
    await m().getByRole("button", { name: "관리자 초대" }).click();
    const d = dialog(ops, "첫 고객사 관리자 초대");
    await d.getByLabel(/이메일/).fill(ADMIN_EMAIL);
    await d.getByLabel(/^이름/).fill(`관리${stamp.slice(-3)}`);
    await expect(d.getByText("외부 도메인 이메일입니다. 초대 대상을 확인하세요.")).toBeVisible();
    await shot(ops, "invite-admin");
    await d.getByRole("button", { name: "초대 링크 생성" }).click();
    await toastSeen(ops, "회사 도메인과 다른 이메일입니다");
    await expect(d).toBeVisible();
    await d.getByRole("button", { name: "초대 링크 생성" }).click();
    const result = dialog(ops, "초대 링크 생성 완료");
    await expect(result.getByText("7일 동안 유효합니다.", { exact: false })).toBeVisible();
    await expect(result.getByText(/\/invite\//)).toBeVisible();
    await shot(ops, "invite-result");
    await result.getByRole("button", { name: "닫기" }).first().click();
    await expect(m().getByRole("cell", { name: ADMIN_EMAIL })).toBeVisible();
  });

  await step("초기 업무 사용자 초대: company domain, project and role", async () => {
    await m().getByRole("button", { name: "사용자 초대" }).click();
    const d = dialog(ops, "초기 업무 사용자 초대");
    await d.getByLabel(/이메일/).fill(MEMBER_EMAIL);
    await d.getByLabel(/^이름/).fill(`요청${stamp.slice(-3)}`);
    await d.getByLabel("역할").selectOption("REQUESTER");
    await d.getByRole("button", { name: "초대 링크 생성" }).click();
    await dialog(ops, "초대 링크 생성 완료").getByRole("button", { name: "닫기" }).first().click();
    await expect(m().getByText("요청자 1명, 검수자 0명")).toBeVisible();
  });

  await step("발신 정보: row validation, then templates and senders saved", async () => {
    await m().getByRole("row", { name: /^기본 프로젝트/ }).getByRole("button", { name: "발신 정보" }).click();
    const d = dialog(ops, "기본 프로젝트 발신 정보");
    await d.getByRole("button", { name: "템플릿 추가" }).click();
    await d.getByLabel("템플릿 1 코드", { exact: true }).fill("잘못된 코드");
    await d.getByRole("button", { name: "저장" }).click();
    await toastSeen(ops, "템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다");
    await expect(d.getByText("템플릿 이름을 입력하세요")).toBeVisible();
    await d.getByLabel("템플릿 1 코드", { exact: true }).fill(TEMPLATE);
    await d.getByLabel("템플릿 1 이름", { exact: true }).fill("가입 안내");
    await d.getByRole("button", { name: "발신번호 추가" }).click();
    await d.getByLabel("발신번호 1", { exact: true }).fill("1588-1234");
    await shot(ops, "sending-modal");
    await d.getByRole("button", { name: "저장" }).click();
    await toastSeen(ops, "발신 정보를 저장했습니다");
    const row = m().getByRole("row", { name: /^기본 프로젝트/ });
    await expect(row.getByText(TEMPLATE)).toBeVisible();
    await expect(row.getByText("1588-1234")).toBeVisible();
    const [project] = await apiAs(OPS, "GET", `/customers/${customerId}/projects`);
    if (project.templates[0]?.code !== TEMPLATE || project.senders[0] !== "1588-1234") throw new Error("sending info not saved");
  });

  await step("배정 화면: assign all four types, change a version, confirm", async () => {
    await m().getByRole("button", { name: "배정 화면" }).click();
    await ops.waitForURL(/\/ops\/standards$/);
    await expect(m().getByRole("heading", { name: `${NAME} 텍스트 교정에 실제 적용되는 기준` })).toBeVisible();
    const alimtalk = await datasetsOf("ALIMTALK");
    const sel = (type) => m().getByLabel(`${NAME} ${LABEL[type]} 데이터셋`);
    if (alimtalk.length > 1) {
      await sel("ALIMTALK").selectOption(String(alimtalk[1].id));
      await toastSeen(ops, `알림톡 v${alimtalk[1].version}을 연결했습니다. 확인 처리까지 해 주세요`);
    }
    for (const type of TYPES) {
      const latest = (await datasetsOf(type))[0];
      await sel(type).selectOption(String(latest.id));
      await toastSeen(ops, `${LABEL[type]} v${latest.version}을 연결했습니다`);
      await expect(sel(type)).toBeEnabled();
    }
    for (const type of TYPES) {
      await m().getByRole("button", { name: `${NAME} ${LABEL[type]} 확인 처리` }).click();
      await expect(m().getByRole("button", { name: `${NAME} ${LABEL[type]} 확인 처리` })).toHaveCount(0);
    }
    await expect(m().getByRole("row", { name: new RegExp(NAME) }).getByText("배정 완료")).toBeVisible();
    await shot(ops, "assign");
    const mine = (await apiAs(OPS, "GET", "/ops/dataset-assignments")).filter((a) => a.customerId === customerId);
    if (mine.length !== 4 || mine.some((a) => !a.checkedAt)) throw new Error(`assignments: ${JSON.stringify(mine)}`);
  });

  await step("unassign 자유입력형, then 최신 배포본 시드 from 초기 설정 (assign + confirm)", async () => {
    await m().getByLabel(`${NAME} 자유입력형 데이터셋`).selectOption("");
    await toastSeen(ops, "배정을 해제했습니다");
    await go("/ops/setup", "초기 설정·시드");
    await m().getByRole("combobox", { name: "고객사 선택" }).selectOption(String(customerId));
    const row = m().getByRole("row", { name: /^자유입력형/ });
    await expect(row.getByText("미배정")).toBeVisible();
    await row.getByRole("button", { name: "최신 배포본 시드" }).click();
    const d = dialog(ops, "자유입력형 교정 규칙 시드");
    await expect(d.getByText("현재 연결된 기준이 없습니다.", { exact: false })).toBeVisible();
    await shot(ops, "seed-rule");
    await d.getByRole("button", { name: "시드 적용" }).click();
    await toastSeen(ops, "유효 데이터셋을 연결했습니다");
    await expect(row.getByText("최신", { exact: true })).toBeVisible();
    await expect(m().getByText("모든 유형에 배정되었습니다.")).toBeVisible();
  });

  await step("유형 관리: RCS off (matrix select disabled), then on again", async () => {
    if (!initialTypes.find((t) => t.type === "RCS").active) throw new Error("RCS is not active before the run");
    await go("/ops/standards", "유형·교정 기준");
    await m().getByRole("tab", { name: "유형 관리" }).click();
    const rcs = m().getByRole("checkbox", { name: "RCS 사용" });
    await expect(rcs).toBeChecked();
    await rcs.uncheck();
    await expect.poll(async () => (await apiAs(OPS, "GET", "/ops/content-types")).find((t) => t.type === "RCS").active).toBe(false);
    await shot(ops, "types-off");
    await m().getByRole("tab", { name: "유효 데이터셋 배정" }).click();
    await expect(m().getByLabel(`${NAME} RCS 데이터셋`)).toBeDisabled();
    await m().getByRole("tab", { name: "유형 관리" }).click();
    await m().getByRole("checkbox", { name: "RCS 사용" }).check();
    await expect.poll(async () => (await apiAs(OPS, "GET", "/ops/content-types")).find((t) => t.type === "RCS").active).toBe(true);
  });

  await step("데이터셋 등록: JSON row errors listed, then the sample XLSX as a new 자유입력형 version", async () => {
    await m().getByRole("tab", { name: "데이터셋 시드" }).click();
    await expect(m().getByRole("heading", { level: 1, name: "교정 데이터셋" })).toBeVisible();
    const before = (await datasetsOf("FREEFORM"))[0];
    await m().getByRole("button", { name: "데이터셋 등록" }).click();
    const d = dialog(ops, "교정 데이터셋 시드 등록");
    await d.getByLabel("유형").selectOption("FREEFORM");
    await d.getByRole("button", { name: "JSON 붙여넣기" }).click();
    await d
      .getByLabel(/규칙 JSON 배열/)
      .fill('[{"ruleId":"","originalExpr":"되요","recommendedExpr":"돼요"},{"ruleId":"B","originalExpr":"a","originalPattern":"b"}]');
    await d.getByRole("button", { name: "등록" }).click();
    const alert = d.getByRole("alert");
    await expect(alert.getByText("교정 규칙을 확인하세요")).toBeVisible();
    await expect(alert.getByText("1행: rule_id를 입력하세요")).toBeVisible();
    await expect(alert.getByText("2행: original_expr와 original_pattern 중 하나만 입력하세요")).toBeVisible();
    await shot(ops, "dataset-row-errors");
    await d.getByRole("button", { name: "XLSX 파일" }).click();
    await d.getByLabel(/규칙 파일/).setInputFiles(XLSX);
    await d.getByRole("button", { name: "등록" }).click();
    await toastSeen(ops, `자유입력형 v${before.version + 1} 데이터셋을 등록했습니다`);
    await expect(d).toBeHidden();
    const row = m().getByRole("row", { name: new RegExp(`^자유입력형\\s*v${before.version + 1}`) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /규칙 보기/ }).click();
    const rules = dialog(ops, new RegExp(`자유입력형 v${before.version + 1} 규칙`));
    await expect(rules.getByRole("row").nth(1)).toBeVisible();
    await shot(ops, "dataset-rules");
    await rules.getByRole("button", { name: "닫기" }).last().click();
  });

  await step("샘플: create and clear a sample request on 한빛카드", async () => {
    await go("/ops/setup", "초기 설정·시드");
    await m().getByRole("combobox", { name: "고객사 선택" }).selectOption({ label: "한빛카드" });
    const panel = m().getByRole("region", { name: "샘플 요청·콘텐츠" });
    await panel.getByRole("button", { name: "샘플 요청 생성" }).click();
    const d = dialog(ops, "샘플 요청·콘텐츠 생성");
    await d.getByLabel("콘텐츠 유형").selectOption("ALIMTALK");
    await shot(ops, "sample-modal");
    await d.getByRole("button", { name: "생성" }).click();
    await toastSeen(ops, "샘플 요청을 만들었습니다");
    await expect(panel.getByText(/\[샘플\] 알림톡 작성 연습/).first()).toBeVisible();
    const { samples } = await apiAs(OPS, "GET", "/ops/customers/1/sample-requests");
    await panel.getByRole("button", { name: "샘플만 초기화" }).click();
    const c = dialog(ops, "샘플 데이터만 초기화할까요?");
    await expect(c.getByText(`샘플 요청 ${samples.length}건`)).toBeVisible();
    await c.getByRole("button", { name: "샘플 초기화" }).click();
    await toastSeen(ops, `샘플 ${samples.length}건을 지웠습니다`);
    await expect(panel.getByText("생성된 샘플이 없습니다.")).toBeVisible();
    await expect(m().getByRole("cell", { name: "샘플 초기화" }).first()).toBeVisible();
  });

  await step("logs: 운영 이력 of the test customer, outbox mail, setup log", async () => {
    await go("/ops/customers", "고객사 관리");
    await m().getByRole("combobox", { name: "운영 이력 고객사" }).selectOption(String(customerId));
    for (const action of ["유효 데이터셋 확인", "유효 데이터셋 해제", "유효 데이터셋 변경"]) {
      await expect(m().getByRole("cell", { name: action, exact: true }).first()).toBeVisible();
    }
    await shot(ops, "customers");
    // older entries (고객사 생성, 사용자 초대, 발신 정보) are on the next pages (12 per page)
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      for (const action of ["고객사 생성", "사용자 초대", "프로젝트 발신 정보 변경"]) {
        if (await m().getByRole("cell", { name: action, exact: true }).count()) seen.add(action);
      }
      const next = m().getByRole("button", { name: "다음" });
      if (seen.size === 3 || !(await next.count()) || (await next.isDisabled())) break;
      await next.click();
      await ops.waitForTimeout(500);
    }
    if (seen.size !== 3) throw new Error(`운영 이력 missing: only ${[...seen].join(", ")}`);
    await go("/ops/setup", "초기 설정·시드");
    await m().getByRole("combobox", { name: "고객사 선택" }).selectOption(String(customerId));
    await expect(m().getByRole("cell", { name: "템플릿 등록" })).toBeVisible();
    await expect(m().getByRole("cell", { name: "초대 링크 생성" }).first()).toBeVisible();
    const outbox = m().getByRole("region", { name: "메일 발송 대기함" });
    await expect(outbox.getByText(`TX TMS 초대 · ${MEMBER_EMAIL}`)).toBeVisible();
  });

  await step("내 설정: 시연 데이터 초기화 modal opens and is cancelled", async () => {
    await go("/profile", "내 설정");
    await m().getByRole("button", { name: "시연 데이터 초기화" }).click();
    const d = dialog(ops, "샘플 고객사 데이터 초기화");
    await expect(d.getByText("기본 체험 고객사의 시연 요청만 초기화합니다. 실제 고객사 데이터는 유지됩니다.")).toBeVisible();
    await shot(ops, "reset-modal");
    await d.getByRole("button", { name: "취소" }).click();
    await expect(d).toBeHidden();
  });

  await step("고객사 비활성: reason required, then deactivated (cleanup)", async () => {
    await go("/ops/customers", "고객사 관리");
    const row = m().getByRole("row", { name: new RegExp(NAME) });
    await row.getByRole("button", { name: NAME }).click();
    await expect(m().getByRole("heading", { name: `${NAME} 상세` })).toBeVisible();
    await row.getByRole("button", { name: "비활성" }).click();
    const d = dialog(ops, `${NAME} 비활성화`);
    await d.getByRole("button", { name: "비활성화" }).click();
    await toastSeen(ops, "비활성 사유을(를) 입력하세요");
    await d.getByLabel(/비활성 사유/).fill("E2E 정리");
    await shot(ops, "deactivate");
    await d.getByRole("button", { name: "비활성화" }).click();
    await toastSeen(ops, "비활성 처리했습니다. 데이터는 보존됩니다");
    await expect(row.getByRole("button", { name: "사용 재개" })).toBeVisible();
    customerId = 0;
  });
} finally {
  await cleanup();
}

log("ops flow passed");
await close();
