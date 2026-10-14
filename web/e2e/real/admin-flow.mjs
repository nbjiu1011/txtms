/**
 * Customer admin (M6) and work management (M5) screens against a running API in demo mode.
 *   node e2e/real/admin-flow.mjs            (BASE=http://localhost:4246, API_ORIGIN=http://localhost:4245)
 * 강민호 (u11, 한빛카드 admin) creates a project, invites an external-domain user (confirmation step),
 * reads the unmasked outbox of the sample customer, the invitee accepts in a fresh context, roles are
 * edited, a notice is published / edited / unpublished / deleted / restored (김서연 sees it only while published,
 * 문지아 of 도담생명 never), a
 * variable is registered / edited / deleted while an in-use one stays protected, settings change and
 * are restored, a user is deactivated with a lead handover and reactivated, a blocked deactivation
 * shows the server details. A throwaway customer (ops API) shows the masked outbox. 이도현 (u3) opens
 * 업무량·실적. Data stays in the dev DB; the test user and the throwaway customer are deactivated.
 */
import { expect } from "@playwright/test";
import { API, BASE, apiAs, dialog, log, main, pick, startRun, toastSeen, watchConsole } from "./helpers.mjs";

const { browser, persona, step, shot, close } = await startRun("admin");
const stamp = Date.now().toString(36);
const PROJECT = `E2E 프로젝트 ${stamp}`;
const INVITEE = `e2e.${stamp}@partner-example.com`;
const INVITEE_NAME = `협력${stamp.slice(-4)}`;
const PASSWORD = "e2e-pass-2026";
const NOTICE = `E2E 공지 ${stamp}`;
const VAR_KEY = `e2e_${stamp}`;
const OPS = 5;
const ADMIN = 11;

const admin = await persona("u11", "강민호");
const m = () => main(admin);
const go = async (page, path, heading) => {
  await page.goto(`${BASE}${path}`);
  await expect(main(page).getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
};
const row = (page, text) => main(page).getByRole("row").filter({ hasText: text });
// the users page also lists the outbox (mails name the invitee): user rows come from the users table only
const userRow = (text) => m().getByRole("table", { name: "사용자와 역할" }).getByRole("row").filter({ hasText: text });
let inviteToken = "";
let inviteeId = 0;
let projectId = 0;

await step("프로젝트 추가: required checks, then created with lead and approver", async () => {
  await go(admin, "/admin/projects", "프로젝트 관리");
  // 진행 중 요청 comes with the admin project list (`activeRequestCount`): a number, not a separate call
  await expect(m().getByRole("row", { name: /^카드 혜택 알림/ }).getByRole("cell").nth(4)).toHaveText(/^\d+$/);
  await m().getByRole("button", { name: "프로젝트 추가" }).click();
  const d = dialog(admin, "프로젝트 추가");
  await d.getByRole("button", { name: "저장" }).click();
  await toastSeen(admin, "프로젝트 이름을(를) 입력하세요");
  await d.getByLabel(/프로젝트 이름/).fill(PROJECT);
  await d.getByRole("button", { name: "저장" }).click();
  await toastSeen(admin, "대표 검수자을(를) 입력하세요");
  await pick(d.getByLabel(/대표 검수자/), { label: "이도현  콘텐츠검수팀" });
  await d.getByRole("button", { name: "저장" }).click();
  await toastSeen(admin, "승인자를 한 명 이상 지정하세요");
  await d.getByRole("checkbox", { name: /최민아/ }).check();
  await shot(admin, "project-modal");
  await d.getByRole("button", { name: "저장" }).click();
  await expect(d).toBeHidden();
  await expect(row(admin, PROJECT)).toContainText("이도현");
  await expect(row(admin, PROJECT)).toContainText("최민아");
  const projects = await apiAs(ADMIN, "GET", "/customers/1/projects");
  projectId = projects.find((p) => p.name === PROJECT).id;
});

await step("사용자 초대: external domain needs a second click, then the invitation is created", async () => {
  await go(admin, "/admin/users", "사용자·권한 관리");
  await m().getByRole("button", { name: "사용자 초대" }).click();
  const d = dialog(admin, "사용자 초대");
  await d.getByLabel(/이메일/).fill(INVITEE);
  await d.getByLabel(/^이름/).fill(INVITEE_NAME);
  await pick(d.getByLabel("프로젝트"), { label: PROJECT });
  await expect(d.getByText("외부 도메인 이메일입니다. 초대 대상을 확인하세요.")).toBeVisible();
  await shot(admin, "invite-modal");
  await d.getByRole("button", { name: "초대 링크 생성" }).click();
  await toastSeen(admin, "회사 도메인과 다른 이메일입니다");
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "초대 링크 생성" }).click();
  await toastSeen(admin, "초대 링크를 생성했습니다. 사용자 관리의 발송 대기함에서 확인하세요");
  await expect(d).toBeHidden();
  await expect(userRow(INVITEE)).toContainText("초대 대기");
  const members = (await apiAs(ADMIN, "GET", "/customers/1/members?size=100")).content;
  inviteeId = members.find((x) => x.user.email === INVITEE).user.id;
});

await step("초대 재발급 + outbox of the sample customer shows the full link", async () => {
  // the pending row's one action
  await userRow(INVITEE).getByRole("button", { name: "초대 재발급" }).click();
  await toastSeen(admin, "이전 링크를 무효화하고 7일 유효한 새 초대 링크를 생성했습니다");
  const outbox = admin.getByRole("region", { name: "메일 발송 대기함" });
  // Newest first: the reissued mail (the earlier link is no longer valid).
  const mail = outbox.getByRole("row").filter({ hasText: INVITEE }).first();
  await expect(mail).toBeVisible();
  await expect(mail.getByText("링크 가림")).toHaveCount(0);
  await expect(mail.getByRole("cell").nth(0)).toHaveText("초대"); // OutboxMail.kind label
  await expect(mail.getByRole("cell").nth(3)).toHaveText("발송 대기");
  await shot(admin, "outbox-sample");
  // the row opens the mail body
  await mail.getByRole("button", { name: /메일 보기$/ }).click();
  const opened = dialog(admin, "TX TMS 초대");
  const body = await opened.locator("p").first().innerText();
  const match = /\/invite\/([A-Za-z0-9_-]{16,})/.exec(body);
  if (!match) throw new Error(`no full invite link in the sample outbox: ${body}`);
  inviteToken = match[1];
  await opened.getByRole("button", { name: "닫기" }).last().click();
  await expect(opened).toBeHidden();
});

await step("invitee opens the link in a fresh context, sets a password and is signed in", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await ctx.newPage();
  watchConsole(page, "fresh");
  await page.goto(`${BASE}/invite/${inviteToken}`);
  await expect(page.getByText(INVITEE)).toBeVisible();
  await page.locator("#invite-name").fill(INVITEE_NAME);
  await page.locator("#invite-password").fill(PASSWORD);
  await page.getByRole("button", { name: "비밀번호 설정" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/invite"), { timeout: 20_000 });
  await expect(page.getByText(INVITEE_NAME).first()).toBeVisible();
  await page.screenshot({ path: `e2e/real/out/admin-invitee-home.png` });
  await ctx.close();
  // Email + password login works for the activated account.
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: INVITEE, password: PASSWORD, remember: false }),
  });
  if (!res.ok) throw new Error(`login after invitation: ${res.status}`);
});

await step("역할 관리: ticking reviewer clears requester (one click), saved as reviewer", async () => {
  await admin.reload();
  await expect(userRow(INVITEE_NAME).getByText("활성", { exact: true })).toBeVisible();
  await userRow(INVITEE_NAME).getByRole("button", { name: "역할" }).click();
  const d = dialog(admin, `${INVITEE_NAME} 역할 관리`);
  const box = (role) => d.getByRole("checkbox", { name: `${PROJECT} ${role}` });
  await expect(box("요청자")).toBeChecked();
  await expect(box("검수자")).toBeEnabled();
  await box("검수자").check();
  await expect(box("요청자")).not.toBeChecked();
  await shot(admin, "role-modal");
  await d.getByRole("button", { name: "저장" }).click();
  await expect(d).toBeHidden();
  await expect(userRow(INVITEE_NAME)).toContainText("검수자");
});

await step("공지: publish (u1 sees it, u9 does not), edit (수정됨), unpublish, delete, restore", async () => {
  await go(admin, "/admin/notices", "공지 관리");
  await m().getByRole("button", { name: "공지 작성" }).click();
  const d = dialog(admin, "공지 작성");
  await pick(d.getByLabel("공지 범위"), "CUSTOMER");
  await d.getByLabel(/제목/).fill(NOTICE);
  await d.getByLabel(/내용/).fill(`${stamp} 본문입니다.\n두 번째 줄`);
  await shot(admin, "notice-modal");
  await d.getByRole("button", { name: "게시" }).click();
  await toastSeen(admin, "공지를 게시했습니다");
  await expect(row(admin, NOTICE).getByText("게시", { exact: true })).toBeVisible();

  const u1 = await persona("u1", "김서연");
  await go(u1, "/notices", "공지");
  await main(u1).getByRole("button", { name: new RegExp(NOTICE) }).click();
  await expect(main(u1).getByText(`${stamp} 본문입니다.`)).toBeVisible();
  const u9 = await persona("u9", "문지아");
  await go(u9, "/notices", "공지");
  await expect(main(u9).getByText(NOTICE)).toHaveCount(0);
  await u9.context().close();

  // the row opens the notice's admin detail, which holds 수정 · 게시 중지 · 삭제 · 복원 · 게시
  await row(admin, NOTICE).getByRole("button", { name: `${NOTICE} 상세 보기` }).click();
  await expect(m().getByRole("heading", { level: 1, name: NOTICE })).toBeVisible();
  await m().getByRole("button", { name: "수정", exact: true }).click();
  const e = dialog(admin, "공지 수정");
  await e.getByLabel(/제목/).fill(`${NOTICE} (수정)`);
  await e.getByRole("button", { name: "수정" }).click();
  await toastSeen(admin, "공지를 수정했습니다. 이전 내용은 이력으로 남습니다");
  const edited = `${NOTICE} (수정)`;
  await expect(m().getByRole("heading", { level: 1, name: edited })).toBeVisible();
  await expect(m().getByText("수정됨", { exact: true })).toBeVisible();
  await u1.reload();
  await expect(main(u1).getByRole("button", { name: new RegExp(`${NOTICE} \\(수정\\)`) })).toContainText("수정됨");

  await m().getByRole("button", { name: "게시 중지" }).click();
  await dialog(admin, `「${edited}」 공지의 게시를 중지할까요?`).getByRole("button", { name: "게시 중지" }).click();
  await toastSeen(admin, "공지 게시를 중지했습니다");
  await expect(m().getByText("미게시 공지입니다")).toBeVisible();
  await u1.reload();
  await expect(main(u1).getByText(NOTICE)).toHaveCount(0);

  await m().getByRole("button", { name: "삭제", exact: true }).click();
  await dialog(admin, `「${edited}」 공지를 삭제할까요?`).getByRole("button", { name: "삭제" }).click();
  await toastSeen(admin, "공지를 삭제했습니다");
  await expect(m().getByText("삭제된 공지입니다")).toBeVisible();
  await expect(m().getByRole("button", { name: "수정", exact: true })).toHaveCount(0);
  // the list keeps it under 삭제된 공지
  await m().getByRole("button", { name: "목록" }).click();
  await expect(m().getByRole("heading", { level: 1, name: "공지 관리" })).toBeVisible();
  await expect(m().getByText(edited)).toHaveCount(0);
  await m().getByRole("radio", { name: "삭제된 공지" }).click();
  await row(admin, edited).getByRole("button", { name: `${edited} 상세 보기` }).click();
  await m().getByRole("button", { name: "복원" }).click();
  await toastSeen(admin, "공지를 복원했습니다. 게시하면 사용자에게 다시 보입니다");
  await expect(m().getByText("미게시 공지입니다")).toBeVisible();
  await m().getByRole("button", { name: "게시", exact: true }).click();
  await toastSeen(admin, "공지를 게시했습니다");
  await u1.reload();
  await expect(main(u1).getByRole("button", { name: new RegExp(`${NOTICE} \\(수정\\)`) })).toBeVisible();
  // leave the dev DB clean: the test notice ends deleted
  await m().getByRole("button", { name: "삭제", exact: true }).click();
  await dialog(admin, `「${edited}」 공지를 삭제할까요?`).getByRole("button", { name: "삭제" }).click();
  await toastSeen(admin, "공지를 삭제했습니다");
  await u1.context().close();
});

await step("변수: register, edit, delete; an in-use variable stays protected", async () => {
  await go(admin, "/admin/variables", "변수 관리");
  await expect(row(admin, "customer_name")).toContainText("사용 중");
  // the row opens 변수 편집, where 삭제 is blocked for a variable in use
  await row(admin, "customer_name").getByRole("button", { name: "customer_name 편집" }).click();
  const used = dialog(admin, "변수 편집");
  await expect(used.getByRole("button", { name: "삭제" })).toBeDisabled();
  await used.getByRole("button", { name: "취소" }).click();
  await expect(used).toBeHidden();
  await m().getByRole("button", { name: "변수 등록" }).click();
  const d = dialog(admin, "변수 등록");
  await d.getByLabel(/변수 키/).fill(VAR_KEY);
  await pick(d.getByLabel("자료형"), "NUMBER");
  await d.getByLabel(/^값/).fill("abc");
  await d.getByRole("button", { name: "저장" }).click();
  await toastSeen(admin, "정수 또는 소수를 입력하세요");
  await d.getByLabel(/^값/).fill("10");
  await shot(admin, "variable-modal");
  await d.getByRole("button", { name: "저장" }).click();
  await expect(d).toBeHidden();
  await expect(row(admin, VAR_KEY)).toContainText("등록");
  await row(admin, VAR_KEY).getByRole("cell").nth(3).click(); // a row click (값) opens the editor
  const e = dialog(admin, "변수 편집");
  await e.getByLabel(/^값/).fill("20");
  await e.getByRole("button", { name: "저장" }).click();
  await expect(row(admin, VAR_KEY)).toContainText("변경");
  await row(admin, VAR_KEY).getByRole("button", { name: `${VAR_KEY} 편집` }).click();
  const del = dialog(admin, "변수 편집");
  await del.getByRole("button", { name: "삭제" }).click();
  await dialog(admin, `「${VAR_KEY}」 변수를 삭제할까요?`).getByRole("button", { name: "삭제" }).click();
  await toastSeen(admin, "변수를 삭제했습니다");
  await expect(del).toBeHidden();
  // the deleted variable stays listed with its history (reference 삭제 (이력 보존), `includeDeleted=true`)
  await expect(row(admin, VAR_KEY)).toContainText("삭제 (이력 보존)");
  await expect(row(admin, VAR_KEY).getByRole("cell").nth(4)).toHaveText("삭제");
  await expect(row(admin, VAR_KEY).getByRole("button")).toHaveCount(0);
  const vars = await apiAs(ADMIN, "GET", "/projects/1/variables");
  const inUse = vars.find((v) => v.key === "customer_name");
  const refused = await apiAs(ADMIN, "DELETE", `/variables/${inUse.id}`).catch((err) => err.message);
  if (!String(refused).includes("사용 중인 변수는 삭제할 수 없습니다")) throw new Error(`in-use delete: ${refused}`);
});

await step("고객사 설정: due-soon days and name save with toasts (restored)", async () => {
  await go(admin, "/admin/customer", "고객사 설정");
  const due = m().getByLabel("납기 임박 기준");
  const before = (await due.getAttribute("data-value")) ?? "";
  await pick(due, "2");
  await toastSeen(admin, "운영 설정을 저장했습니다");
  await pick(due, before);
  const name = m().getByLabel("고객사 이름");
  await name.fill("한빛카드 E2E");
  await name.press("Enter");
  await toastSeen(admin, "고객사 이름을 저장했습니다");
  await expect(admin.getByRole("combobox").first()).toContainText("한빛카드 E2E");
  await name.fill("한빛카드");
  await name.press("Enter");
  await toastSeen(admin, "고객사 이름을 저장했습니다");
});

await step("비활성화 blocked for a requester with work in progress (server details)", async () => {
  await go(admin, "/admin/users", "사용자·권한 관리");
  // 비활성화 lives on the user's detail page (the row opens it)
  await userRow("seoyeon.kim").getByRole("button", { name: "김서연 상세 보기" }).click();
  await expect(m().getByRole("heading", { level: 1, name: "김서연" })).toBeVisible();
  await m().getByRole("button", { name: "비활성화" }).click();
  const d = dialog(admin, "김서연님을 비활성화할까요?");
  await expect(d.getByText("요청자로 진행 중")).toBeVisible();
  await d.getByRole("button", { name: "비활성화" }).click();
  await expect(d.getByRole("alert")).toContainText("요청자로 진행 중인 요청이");
  await expect(d.getByRole("alert").locator("li").first()).toBeVisible();
  await shot(admin, "deactivate-blocked");
  await d.getByRole("button", { name: "취소" }).click();
});

await step("비활성화 with lead handover, then 재활성화", async () => {
  await apiAs(ADMIN, "PATCH", `/projects/${projectId}`, { leadUserId: inviteeId });
  await go(admin, "/admin/users", "사용자·권한 관리");
  await userRow(INVITEE_NAME).getByRole("cell").nth(1).click(); // a row click (소속) opens the detail
  await expect(m().getByRole("heading", { level: 1, name: INVITEE_NAME })).toBeVisible();
  await m().getByRole("button", { name: "비활성화" }).click();
  const d = dialog(admin, `${INVITEE_NAME}님을 비활성화할까요?`);
  await expect(d.getByText(PROJECT)).toBeVisible();
  await d.getByRole("button", { name: "비활성화" }).click();
  await toastSeen(admin, "대체자을(를) 입력하세요");
  await pick(d.getByLabel(/대체자/), { label: "박지훈" });
  await d.getByLabel(/인수인계 내용/).fill("E2E 인수인계");
  await shot(admin, "deactivate-modal");
  await d.getByRole("button", { name: "비활성화" }).click();
  await expect(d).toBeHidden();
  await expect(m().getByText("비활성화된 사용자입니다")).toBeVisible();
  const p = (await apiAs(ADMIN, "GET", `/projects/${projectId}`)).leadUserId;
  if (p !== 2) throw new Error(`lead not handed over: ${p}`);
  await m().getByRole("button", { name: "재활성화" }).click();
  await expect(m().getByText("비활성화된 사용자입니다")).toHaveCount(0);
  await m().getByRole("button", { name: "목록" }).click();
  await expect(userRow(INVITEE_NAME).getByText("활성", { exact: true })).toBeVisible();
});

await step("접근·변경 기록 sub tab lists the audit (dashboard banner button)", async () => {
  await go(admin, "/admin/users", "사용자·권한 관리");
  await m().getByRole("tab", { name: "접근·변경 기록" }).click();
  await expect(m().getByRole("cell", { name: "사용자 재활성화" }).first()).toBeVisible();
  await expect(m().getByRole("cell", { name: "강민호" }).first()).toBeVisible();
  await shot(admin, "audit");
});

await step("masked outbox for a non-sample customer (ops API setup, admin signs in by email)", async () => {
  const domain = `e2e${stamp}.example.com`;
  const customer = await apiAs(OPS, "POST", "/ops/customers", { name: `E2E고객 ${stamp}`, domain, approvalEnabled: false });
  const adminEmail = `admin@${domain}`;
  await apiAs(OPS, "POST", `/ops/customers/${customer.id}/invitations`, {
    email: adminEmail,
    name: "E2E관리자",
    dept: "",
    admin: true,
    externalDomainConfirmed: false,
  });
  const opsMail = (await apiAs(OPS, "GET", "/ops/outbox?size=50")).content.find((x) => x.to === adminEmail);
  const token = /\/invite\/([A-Za-z0-9_-]{16,})/.exec(opsMail.body)[1];
  await fetch(`${API}/auth/tokens/${token}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "E2E관리자", password: PASSWORD }),
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await ctx.newPage();
  watchConsole(page, "fresh");
  await page.goto(`${BASE}/login`);
  await page.locator("#lg-e").fill(adminEmail);
  await page.locator("#lg-p").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await go(page, "/admin/users", "사용자·권한 관리");
  await main(page).getByRole("button", { name: "사용자 초대" }).click();
  const d = dialog(page, "사용자 초대");
  await d.getByLabel(/이메일/).fill(`member@${domain}`);
  await d.getByLabel(/^이름/).fill("E2E구성원");
  await d.getByRole("button", { name: "초대 링크 생성" }).click();
  await expect(d).toBeHidden();
  const mail = page
    .getByRole("region", { name: "메일 발송 대기함" })
    .getByRole("row")
    .filter({ hasText: `member@${domain}` })
    .first();
  await expect(mail.getByText("링크 가림")).toBeVisible();
  await mail.getByRole("button", { name: /메일 보기$/ }).click();
  const opened = page.getByRole("dialog");
  await expect(opened).toContainText("••••");
  await expect(opened).toContainText("링크는 수신자에게만 전달됩니다");
  await page.screenshot({ path: "e2e/real/out/admin-outbox-masked.png" });
  await ctx.close();
  await apiAs(OPS, "POST", `/ops/customers/${customer.id}/deactivate`, { reason: "E2E 정리" });
});

await step("이도현 (lead) opens 업무량·실적: KPIs, all projects, user filter", async () => {
  const lead = await persona("u3", "이도현");
  await go(lead, "/performance", "업무량·실적");
  const mm = main(lead);
  await expect(mm.getByText("접수 집단 완료율")).toBeVisible();
  await expect(mm.getByRole("heading", { name: "개인 실적" })).toBeVisible();
  await shot(lead, "performance");
  await pick(mm.getByLabel("프로젝트"), { label: "권한 있는 전체" });
  await pick(mm.getByLabel("사용자"), { label: "박지훈" });
  await expect(mm.getByRole("row").filter({ hasText: "박지훈" }).first()).toBeVisible();
  await expect(mm.getByRole("row").filter({ hasText: "한가을" })).toHaveCount(1); // workload table only
  // a period picked in the calendar (quick pick 최근 7일) replaces the 기간 preset
  await mm.getByLabel("접수일 직접 지정").click();
  await lead.getByRole("button", { name: "최근 7일" }).click();
  await expect(mm.getByLabel("접수일 직접 지정")).toHaveAttribute("data-from", /^\d{4}-\d{2}-\d{2}$/);
  await expect(mm.getByRole("heading", { name: "개인 실적" })).toBeVisible();
});

await step("cleanup: the invited test user is deactivated", async () => {
  await apiAs(ADMIN, "POST", `/customers/1/users/${inviteeId}/deactivate`, { substituteUserId: null, handover: "" }).catch(
    (err) => log(`cleanup: ${err.message}`),
  );
});

await close();
log("admin flow done");
