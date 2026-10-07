/**
 * Completion results, exports, follow-ups and the content archive against a running API in demo mode.
 *   node e2e/real/result-flow.mjs            (BASE=http://localhost:3000, API_ORIGIN=http://localhost:8080)
 * Creates fresh requests in the dev DB on every run (an 알림톡 request with two contents, its
 * follow-ups, a 자유입력형 request with a real upload, a clone of the seed REQ-2609-107 whose seed file
 * has no stored original). Assignment, completion and approval of setup requests go through the API;
 * everything under test is driven in the browser as 김서연. Screenshots / downloads: e2e/real/out.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import {
  BASE,
  OUT,
  U,
  apiAs,
  approveThroughApi,
  dialog,
  log,
  main,
  startRun,
  statusIs,
  submitThroughApi,
  toastSeen,
} from "./helpers.mjs";

const FILES = "e2e/real/files";
const { persona, step, shot, close } = await startRun("result", { permissions: ["clipboard-read", "clipboard-write"] });
const stamp = Date.now().toString(36);
const TITLE = `M3 완료 결과 ${stamp}`;
const CAMPAIGN = `M3 캠페인 ${stamp}`;
const C1_TITLE = `적립 안내 ${stamp}`;
const C2_TITLE = `두 번째 안내 ${stamp}`;
const C1_BODY = `#{customer_name}님, ${stamp} 포인트가 적립되었습니다.`;
const C1_RESOLVED = `홍길동님, ${stamp} 포인트가 적립되었습니다.`;
const C2_BODY = `${stamp} 두 번째 안내입니다.`;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const TOMORROW = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + 86_400_000));

let id = "";
let fuWhole = "";
let fuSingle = "";
const page = await persona("u1", "김서연");
const m = () => main(page);
const saved = () =>
  expect(m().getByRole("status").filter({ hasText: /^저장됨/ }).first()).toBeVisible({ timeout: 10_000 });
const openRequest = async (rid) => {
  await page.goto(`${BASE}/requests/${rid}`);
  await expect(m().getByRole("heading", { level: 1 })).toBeVisible();
};
const openResult = async (rid) => {
  await openRequest(rid);
  await m().getByRole("tab", { name: "완료 결과" }).click();
  await expect(m().getByRole("heading", { name: "완료 묶음" })).toBeVisible();
};
const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
const errorCodes = [];
page.on("response", async (res) => {
  if (res.status() >= 400 && res.url().includes("/api/")) {
    const body = await res.json().catch(() => null);
    errorCodes.push(`${res.status()} ${body?.code ?? ""} ${new URL(res.url()).pathname}`);
  }
});

/* ---------- a fresh 알림톡 request with two contents ---------- */

await step("create; submit-check lists missing items before the confirmation", async () => {
  await page.getByRole("button", { name: /새 요청/ }).first().click();
  await page.waitForURL(/\/requests\/REQ-/);
  id = page.url().split("/").pop();
  await m().getByLabel("제목", { exact: true }).fill(TITLE);
  await m().getByLabel("희망 납기").fill("2026-11-30");
  await m().getByLabel("목적").fill("완료 결과 확인");
  await m().getByLabel("배경").fill("M3 점검");
  await m().getByLabel("캠페인").fill(CAMPAIGN);
  await saved();
  const check = page.waitForResponse((r) => r.url().endsWith(`/requests/${id}/submit-check`));
  await page.getByRole("button", { name: "검수 요청" }).click();
  expect((await check).status()).toBe(200);
  const missing = dialog(page, "검수를 요청하려면 다음 항목을 채우세요");
  await expect(missing.getByText("요청 정보: 대상 고객")).toBeVisible();
  await expect(dialog(page, "검수를 요청할까요?")).toHaveCount(0);
  await missing.getByRole("button", { name: "확인" }).click();
  await m().getByLabel("대상 고객").fill("카드 보유 고객");
  await saved();
  log(`created ${id}`);
});

await step("fill C1 (with a variable) and C2, submit", async () => {
  await m().getByRole("tab", { name: /콘텐츠/ }).click();
  await m().getByLabel("콘텐츠 제목").fill(C1_TITLE);
  await m().getByLabel("승인 템플릿").selectOption({ index: 1 });
  await m().getByLabel("본문").fill(C1_BODY);
  await saved();
  await m().getByRole("button", { name: "콘텐츠 추가" }).click();
  await expect(m().getByText("콘텐츠 2건")).toBeVisible();
  await expect(m().getByText("C2 v1", { exact: true })).toBeVisible();
  await m().getByLabel("콘텐츠 제목").fill(C2_TITLE);
  await m().getByLabel("승인 템플릿").selectOption({ index: 1 });
  await m().getByLabel("본문").fill(C2_BODY);
  await saved();
  await page.getByRole("button", { name: "검수 요청" }).click();
  const confirm = dialog(page, "검수를 요청할까요?");
  await expect(confirm.getByText("검수 차수가", { exact: false })).toHaveCount(0);
  await confirm.getByRole("button", { name: "검수 요청" }).click();
  await toastSeen(page, "검수를 요청했습니다");
  await statusIs(page, "배정 대기");
});

await step("assign → complete → approve (API)", async () => {
  const detail = await approveThroughApi(id);
  expect(detail.status).toBe("APPROVED");
});

/* ---------- 완료 결과 ---------- */

await step("result tab: bundle, variables, no ZIP button without attachments", async () => {
  await openResult(id);
  await statusIs(page, "승인 완료");
  const table = m().getByRole("table");
  await expect(table.getByRole("row", { name: new RegExp(`C1 ${C1_TITLE}`) })).toBeVisible();
  await expect(table.getByRole("row", { name: new RegExp(`C2 ${C2_TITLE}`) })).toBeVisible();
  await expect(m().getByText("customer_name = 홍길동")).toBeVisible();
  await expect(m().getByRole("button", { name: "첨부 최종본 묶음" })).toHaveCount(0);
  await shot(page, "01-result-tab");
});

await step("copy C1: completion-time values on the clipboard + audit event", async () => {
  const audit = page.waitForResponse((r) => r.url().endsWith(`/requests/${id}/bundle/copy-events`));
  await m().getByRole("button", { name: "C1 문안 복사" }).click();
  await toastSeen(page, "문안을 복사했습니다");
  expect((await audit).status()).toBe(204);
  expect(await clipboard()).toBe(C1_RESOLVED);
});

await step("XLSX export downloads a non-empty workbook", async () => {
  await m().getByRole("button", { name: "요청 전체 XLSX 반출" }).click();
  const d = dialog(page, "요청 전체 XLSX 반출");
  await expect(d.getByText(`${TITLE} · 콘텐츠 2건 · ${TODAY} (KST)`)).toBeVisible();
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "파일 받기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${id}_완료본.xlsx`);
  const path = join(OUT, `result-${id}.xlsx`);
  await file.saveAs(path);
  const bytes = readFileSync(path);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  await expect(d).toHaveCount(0);
  log(`xlsx ${bytes.length} bytes`);
});

/* ---------- follow-ups ---------- */

await step("후속 요청 작성 (whole request) → new draft, breadcrumb back to the original", async () => {
  await page.getByRole("button", { name: "후속 요청 작성" }).click();
  await toastSeen(page, "완료본과 연결된 후속 요청을 만들었습니다");
  await page.waitForURL((u) => u.pathname.startsWith("/requests/REQ-") && !u.pathname.endsWith(id));
  fuWhole = page.url().split("/").pop();
  await expect(m().getByRole("heading", { level: 1, name: `${TITLE} 후속` })).toBeVisible();
  await statusIs(page, "작성 중");
  await expect(m().getByText("콘텐츠 2건")).toBeVisible();
  await expect(m().getByLabel("본문")).toHaveValue(C1_BODY);
  await shot(page, "02-follow-up-whole");
  await m().getByRole("link", { name: `원본 ${id}` }).click();
  await page.waitForURL(new RegExp(`/requests/${id}$`));
  await expect(m().getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  log(`follow-up (whole) ${fuWhole}`);
});

await step("후속 요청 of C2 from the result row → draft with that item only", async () => {
  await m().getByRole("tab", { name: "완료 결과" }).click();
  await m().getByRole("button", { name: "C2 후속 요청" }).click();
  await toastSeen(page, "완료본과 연결된 후속 요청을 만들었습니다");
  await page.waitForURL((u) => u.pathname.startsWith("/requests/REQ-") && !u.pathname.endsWith(id) && !u.pathname.endsWith(fuWhole));
  fuSingle = page.url().split("/").pop();
  await expect(m().getByText("콘텐츠 1건")).toBeVisible();
  await expect(m().getByLabel("콘텐츠 제목")).toHaveValue(C2_TITLE);
  log(`follow-up (C2) ${fuSingle}`);
});

await step("complete the C2 follow-up (API) so the line has a past version", async () => {
  await apiAs(U.requester, "PATCH", `/requests/${fuSingle}`, { hopeDueDate: "2026-11-30" });
  await submitThroughApi(fuSingle);
  expect((await approveThroughApi(fuSingle)).status).toBe("APPROVED");
});

/* ---------- 콘텐츠 archive ---------- */

const lines = () => m().getByRole("list", { name: "완료 콘텐츠" }).getByRole("listitem");
const line = (title) => m().getByRole("listitem", { name: new RegExp(`^${title}`) });

await step("archive: lineage (past + follow-ups), toggle labels", async () => {
  await page.goto(`${BASE}/contents`);
  await expect(m().getByRole("heading", { level: 1, name: "콘텐츠" })).toBeVisible();
  await m().getByLabel("문안, 파일명, 본문").fill(stamp);
  await expect(lines()).toHaveCount(2);
  await expect(lines().first()).toHaveAccessibleName(new RegExp(`^${C2_TITLE}`));
  const c2 = line(C2_TITLE);
  await expect(c2.getByText(new RegExp(`${fuSingle}\\s+알림톡\\s+승인 완료`))).toBeVisible();
  await c2.getByRole("button", { name: "이력 2" }).click();
  await expect(c2.getByRole("button", { name: "접기" })).toBeVisible();
  await expect(c2.getByText(/과거 완료본/)).toContainText(id);
  await expect(c2.getByText(/후속 요청 REQ/)).toContainText(fuWhole);
  const c1 = line(C1_TITLE);
  // the preview is the raw text with variable chips (reference `renderVars`, `previewRaw`); 복사 uses the values
  await expect(c1.getByText("customer_name", { exact: true })).toBeVisible();
  await expect(c1.getByText(`님, ${stamp} 포인트가 적립되었습니다.`)).toBeVisible();
  await c1.getByRole("button", { name: "이력 1" }).click();
  await expect(c1.getByText(/후속 요청 REQ/)).toContainText(fuWhole);
  await expect(c1.getByText("작성 중")).toBeVisible();
  await shot(page, "03-archive-lineage");
  await c1.getByRole("button", { name: "접기" }).click();
  await expect(c1.getByRole("button", { name: "이력 1" })).toBeVisible();
});

await step("archive: copy uses the resolved text; 새 탭 opens the content", async () => {
  const c1 = line(C1_TITLE);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await c1.getByRole("button", { name: "복사" }).click();
  await toastSeen(page, "문안을 복사했습니다");
  await expect.poll(clipboard).toBe(C1_RESOLVED);
  await c1.getByRole("button", { name: "새 탭" }).click();
  await page.waitForURL(new RegExp(`/requests/${id}/contents/C1$`));
  await expect(m().getByRole("heading", { level: 1, name: C1_TITLE })).toBeVisible();
});

await step("archive: filters (campaign, type, status, completion date, reset)", async () => {
  await page.goto(`${BASE}/contents`);
  const f = m().getByRole("search", { name: "콘텐츠 검색 조건" });
  await f.getByLabel("문안, 파일명, 본문").fill("");
  await f.getByLabel("캠페인").selectOption(CAMPAIGN);
  await expect(lines()).toHaveCount(2);
  await f.getByLabel("유형").selectOption("SMS");
  await expect(m().getByText("보관된 완료 콘텐츠가 없습니다")).toBeVisible();
  await f.getByLabel("유형").selectOption("ALIMTALK");
  await f.getByLabel("요청 상태").selectOption("REVIEW_COMPLETED");
  await expect(m().getByText("보관된 완료 콘텐츠가 없습니다")).toBeVisible();
  await f.getByLabel("요청 상태").selectOption("APPROVED");
  await expect(lines()).toHaveCount(2);
  await f.getByLabel("완료일 시작").fill(TODAY);
  await f.getByLabel("완료일 끝").fill(TODAY);
  await expect(lines()).toHaveCount(2);
  await f.getByLabel("완료일 시작").fill(TOMORROW);
  await f.getByLabel("완료일 끝").fill(TOMORROW);
  await expect(m().getByText("보관된 완료 콘텐츠가 없습니다")).toBeVisible();
  await shot(page, "04-archive-filtered-empty");
  await f.getByRole("button", { name: "초기화" }).click();
  await expect(f.getByLabel("캠페인")).toHaveValue("");
  await expect(lines().first()).toBeVisible();
  const more = m().getByRole("button", { name: "더 보기" });
  if (await more.isVisible()) {
    const before = await lines().count();
    await more.click();
    await expect.poll(() => lines().count()).toBeGreaterThan(before);
    log(`더 보기: ${before} → ${await lines().count()} lines`);
  } else log(`one page of lines (${await lines().count()})`);
});

await step("archive: 후속 요청 from a line (requester)", async () => {
  await m().getByLabel("문안, 파일명, 본문").fill(stamp);
  await expect(lines()).toHaveCount(2);
  await line(C1_TITLE).getByRole("button", { name: "후속 요청" }).click();
  await toastSeen(page, "완료본과 연결된 후속 요청을 만들었습니다");
  await page.waitForURL((u) => u.pathname.startsWith("/requests/REQ-"));
  await expect(m().getByLabel("본문")).toHaveValue(C1_BODY);
  log(`follow-up (archive line) ${page.url().split("/").pop()}`);
});

/* ---------- 자유입력형 with a real upload: scan outcomes + ZIP ---------- */

let freeId = "";
await step("자유입력형 uploads: FILE_UNSAFE / FILE_SCAN_FAILED / SAFE", async () => {
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: /새 요청/ }).first().click();
  await page.waitForURL((u) => /\/requests\/REQ-/.test(u.pathname));
  freeId = page.url().split("/").pop();
  await m().getByLabel("제목", { exact: true }).fill(`M3 첨부 반출 ${stamp}`);
  await m().getByLabel("희망 납기").fill("2026-11-30");
  await m().getByLabel("목적").fill("첨부 반출 확인");
  await m().getByLabel("대상 고객").fill("전체 회원");
  await m().getByLabel("배경").fill("M3 점검");
  await m().getByLabel("유형").selectOption("FREEFORM");
  await expect(m().getByLabel("유형")).toHaveValue("FREEFORM");
  await m().getByRole("tab", { name: /콘텐츠/ }).click();
  const scan = m().getByLabel("첨부 검사 결과", { exact: true });
  const input = m().getByLabel("첨부파일 선택");
  await scan.selectOption("UNSAFE");
  await input.setInputFiles(join(FILES, "notes.txt"));
  await expect(m().getByText(/notes\.txt · 안전하지 않은 파일로 등록 차단/).first()).toBeVisible();
  await scan.selectOption("FAILED");
  await input.setInputFiles(join(FILES, "notes.txt"));
  await expect(m().getByText(/notes\.txt · 검사 실패/).first()).toBeVisible();
  // the response listener reads the body asynchronously: wait for it instead of reading the list at once
  await expect.poll(() => errorCodes.some((c) => c.includes("FILE_UNSAFE"))).toBe(true);
  await expect.poll(() => errorCodes.some((c) => c.includes("FILE_SCAN_FAILED"))).toBe(true);
  await scan.selectOption("SAFE");
  await input.setInputFiles(join(FILES, "약관 개정안.pdf"));
  await expect(m().getByText(/약관 개정안\.pdf · 업로드 완료/)).toBeVisible();
  await m().getByLabel("약관 개정안.pdf 전체 분량").fill("14");
  await m().getByLabel("약관 개정안.pdf 실제 검수 범위").fill("6");
  await saved();
  await shot(page, "05-freeform-uploads");
  await page.getByRole("button", { name: "검수 요청" }).click();
  await dialog(page, "검수를 요청할까요?").getByRole("button", { name: "검수 요청" }).click();
  await toastSeen(page, "검수를 요청했습니다");
  log(`freeform ${freeId}`);
});

await step("자유입력형 approved (API) → ZIP export has the file and the manifest", async () => {
  await approveThroughApi(freeId);
  await openResult(freeId);
  await expect(m().getByText("약관 개정안.pdf (v1)")).toBeVisible();
  await expect(m().getByRole("button", { name: "C1 문안 복사" })).toHaveCount(0);
  await m().getByRole("button", { name: "첨부 최종본 묶음" }).click();
  const d = dialog(page, "첨부 최종본 ZIP");
  const download = page.waitForEvent("download");
  await d.getByRole("button", { name: "묶음 받기" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${freeId}_첨부_완료본.zip`);
  const path = join(OUT, `result-${freeId}.zip`);
  await file.saveAs(path);
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.includes(Buffer.from("완료_버전_명세.json"))).toBe(true);
  expect(bytes.includes(Buffer.from("C1/v1_약관 개정안.pdf"))).toBe(true);
  await expect(d).toHaveCount(0);
  await shot(page, "06-freeform-result");
  log(`zip ${bytes.length} bytes`);
});

/* ---------- ZIP of a seed file without a stored original → server message, dialog stays ---------- */

await step("ZIP of a seed attachment (clone of REQ-2609-107) shows the 404 message", async () => {
  const clone = await apiAs(U.requester, "POST", "/requests/REQ-2609-107/clone");
  await apiAs(U.requester, "PATCH", `/requests/${clone.id}`, { hopeDueDate: "2026-11-30" });
  const check = await apiAs(U.requester, "POST", `/requests/${clone.id}/submit-check`, {});
  if (!check.ok) throw new Error(`clone not submittable: ${check.details.join(", ")}`);
  await submitThroughApi(clone.id);
  await approveThroughApi(clone.id);
  await openResult(clone.id);
  await m().getByRole("button", { name: "첨부 최종본 묶음" }).click();
  const d = dialog(page, "첨부 최종본 ZIP");
  await d.getByRole("button", { name: "묶음 받기" }).click();
  await toastSeen(page, "시연용 파일의 원본이 없습니다");
  await expect(d).toBeVisible();
  await shot(page, "07-zip-missing-original");
  await d.getByRole("button", { name: "닫기" }).click();
  log(`seed clone ${clone.id}`);
});

/* ---------- nextSubmitRound after an approved recall ---------- */

await step("resubmit after an approved recall announces the next round", async () => {
  await apiAs(U.requester, "PATCH", `/requests/${fuWhole}`, { hopeDueDate: "2026-11-30" });
  await submitThroughApi(fuWhole);
  const rv = async (uid) => (await apiAs(uid, "GET", `/requests/${fuWhole}`)).rowVersion;
  await apiAs(U.lead, "POST", `/requests/${fuWhole}/assignment`, {
    reviewerIds: [U.reviewer],
    primaryReviewerId: U.reviewer,
    dueDate: "2026-12-31",
    rowVersion: await rv(U.lead),
  });
  await apiAs(U.requester, "POST", `/requests/${fuWhole}/recall`, { reason: "일정 변경", rowVersion: await rv(U.requester) });
  await apiAs(U.reviewer, "POST", `/requests/${fuWhole}/recall/decision`, {
    approve: true,
    comment: "작성 중으로 돌려드립니다",
    rowVersion: await rv(U.reviewer),
  });
  await openRequest(fuWhole);
  await statusIs(page, "작성 중");
  await page.getByRole("button", { name: "검수 요청" }).click();
  const confirm = dialog(page, "검수를 요청할까요?");
  await expect(confirm.getByText("회수 승인 후 다시 요청하므로 검수 차수가 2차로 올라갑니다.")).toBeVisible();
  await shot(page, "08-next-round");
  await confirm.getByRole("button", { name: "닫기" }).click();
});

writeFileSync(join(OUT, "result-ids.txt"), [id, fuWhole, fuSingle, freeId].join("\n"));
log(`done: ${id} (follow-ups ${fuWhole}, ${fuSingle}; freeform ${freeId})`);
await close();
