/**
 * Request authoring flow against a running API in demo mode (creates real drafts in the dev DB).
 *   node e2e/real/draft-flow.mjs            (BASE=http://localhost:4246, FILES=<dir with sample files>)
 * Sample files: bulk-alimtalk.xlsx (template + rows), 약관 개정안.pdf, card.png, notes.txt, script.js.
 * Screenshots go to e2e/real/out (gitignored).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { reportConsole, watchConsole } from "./helpers.mjs";

const BASE = process.env.BASE ?? "http://localhost:4246";
const FILES = process.env.FILES ?? "e2e/real/files";
const OUT = "e2e/real/out";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
watchConsole(page, "u1");
const writes = [];
page.on("response", (r) => {
  if (r.url().includes("/api/") && !["GET", "OPTIONS"].includes(r.request().method()) && !r.url().includes("/auth/"))
    writes.push(`${r.request().method()} ${r.status()} ${new URL(r.url()).pathname}`);
});
const log = (m) => console.log(`- ${m}`);
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const main = page.locator("main [role=tabpanel]:visible");
const saved = () => expect(main.getByRole("status").filter({ hasText: /^저장됨/ }).first()).toBeVisible({ timeout: 10_000 });

async function step(name, fn) {
  try {
    await fn();
    log(`OK  ${name}`);
  } catch (error) {
    log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
    await shot(`fail-${name.replace(/\W+/g, "-")}`);
    reportConsole();
    throw error;
  }
}

await step("login u1", async () => {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /김서연/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
});

let id = "";
await step("새 요청 opens 요청 정보", async () => {
  await page.getByRole("button", { name: /새 요청/ }).first().click();
  await page.waitForURL(/\/requests\/REQ-/);
  id = page.url().split("/").pop();
  await expect(main.getByRole("tab", { name: "요청 정보", selected: true })).toBeVisible();
  log(`created ${id}`);
});

await step("edit info (autosave)", async () => {
  await main.getByLabel("제목").fill("M1 흐름 점검");
  await main.getByLabel("목적").fill("작성 흐름 확인");
  await saved();
  await shot("02-info-saved");
});

await step("submit with missing fields lists them", async () => {
  // the submit pre-check (`submit-check`) lists missing items before the confirmation opens
  await page.getByRole("button", { name: "검수 요청" }).click();
  const missing = page.getByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" });
  await expect(missing).toBeVisible();
  await expect(missing.getByText("요청 정보: 대상 고객")).toBeVisible();
  await shot("03-submit-missing");
  await missing.getByRole("button", { name: "확인" }).click();
  await expect(main.getByText("대상 고객을(를) 입력하세요")).toBeVisible();
  await shot("04-info-errors");
});

await step("fix info", async () => {
  await main.getByLabel("희망 납기").fill("2026-10-30");
  await main.getByLabel("대상 고객").fill("카드 보유 고객");
  await main.getByLabel("배경").fill("M1 점검용 배경");
  await saved();
  await expect(main.getByText("대상 고객을(를) 입력하세요")).toHaveCount(0);
});

await step("edit alimtalk content + variable", async () => {
  await main.getByRole("tab", { name: /콘텐츠/ }).click();
  await main.getByLabel("콘텐츠 제목").fill("포인트 안내");
  await main.getByLabel("승인 템플릿").selectOption({ index: 1 });
  const body = main.getByLabel("본문");
  await body.fill("님, 포인트가 적립되었습니다.");
  await body.evaluate((el) => el.setSelectionRange(0, 0));
  await body.click({ position: { x: 5, y: 5 } });
  await body.press("Home");
  await page.getByRole("button", { name: "변수 삽입" }).click();
  const picker = page.getByRole("dialog", { name: "변수 삽입" });
  await picker.getByLabel("변수 검색").fill("고객");
  await picker.getByRole("button", { name: /customer_name/ }).click();
  await expect(body).toHaveValue(/^#\{customer_name\}님/);
  await main.getByRole("button", { name: "버튼 추가" }).click();
  await main.getByLabel("버튼 1 이름").fill("적립 내역");
  await main.getByLabel("버튼 1 링크").fill("https://hanbitcard.co.kr/point");
  await saved();
  await main.getByRole("tab", { name: "미리보기" }).click();
  await expect(main.getByText("홍길동님, 포인트가 적립되었습니다.")).toBeVisible();
  await shot("05-alimtalk-edit");
});

await step("register variable in picker", async () => {
  await main.getByLabel("본문").click();
  await main.getByLabel("본문").press("End");
  await page.getByRole("button", { name: "변수 삽입" }).click();
  const picker = page.getByRole("dialog", { name: "변수 삽입" });
  await picker.getByLabel("변수 키").fill("Bad Key");
  await picker.getByLabel("값").fill("x");
  await picker.getByRole("button", { name: "등록" }).click();
  await expect(picker.getByText("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요")).toBeVisible();
  await picker.getByLabel("변수 키").fill("customer_name");
  await picker.getByRole("button", { name: "등록" }).click();
  await expect(picker.getByText(/이미 등록된 변수입니다/)).toBeVisible();
  await shot("06-variable-duplicate");
  const key = `m1_${Date.now().toString(36)}`;
  await picker.getByLabel("변수 키").fill(key);
  await picker.getByLabel("자료형").selectOption("NUMBER");
  await picker.getByLabel("값").fill("숫자아님");
  await picker.getByRole("button", { name: "등록" }).click();
  await expect(picker.getByText("정수 또는 소수를 입력하세요")).toBeVisible();
  await picker.getByLabel("값").fill("3");
  await picker.getByLabel("설명").fill("M1 점검 변수");
  await picker.getByRole("button", { name: "등록" }).click();
  await expect(main.getByLabel("본문")).toHaveValue(new RegExp(`#\\{${key}\\}`));
  await saved();
});

await step("add and delete content", async () => {
  await main.getByRole("button", { name: "콘텐츠 추가" }).click();
  await expect(main.getByText("콘텐츠 2건")).toBeVisible();
  await main.getByRole("button", { name: "선택 콘텐츠 삭제" }).click();
  const dlg = page.getByRole("dialog", { name: /C2 .*삭제할까요/ });
  await dlg.getByRole("button", { name: "삭제" }).click();
  await expect(main.getByText("콘텐츠 1건")).toBeVisible();
});

await step("bulk import (alimtalk)", async () => {
  await main.getByRole("button", { name: "XLSX 대량 등록" }).click();
  const dlg = page.getByRole("dialog", { name: "XLSX 대량 등록" });
  await dlg.locator("input[type=file]").setInputFiles(join(FILES, "bulk-alimtalk.xlsx"));
  await expect(dlg.getByText(/전체 5행/)).toBeVisible();
  await expect(dlg.getByLabel("4행 선택")).toBeDisabled();
  await shot("07-bulk-preview");
  await dlg.getByRole("button", { name: "선택한 행 추가" }).click();
  await expect(main.getByText(/콘텐츠 3건/)).toBeVisible();
});

await step("submit", async () => {
  await page.getByRole("button", { name: "검수 요청" }).click();
  const confirm = page.getByRole("dialog", { name: "검수를 요청할까요?" });
  await shot("08-submit-confirm");
  await confirm.getByRole("button", { name: "검수 요청" }).click();
  await expect(page.getByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" })).toHaveCount(0);
  await expect(main.getByText("대표 검수자의 배정을 기다리고 있습니다")).toBeVisible();
  await shot("09-waiting");
});

await step("cancel", async () => {
  await page.getByRole("button", { name: "요청 취소" }).click();
  const dlg = page.getByRole("dialog", { name: "검수 요청을 취소할까요?" });
  await dlg.getByRole("button", { name: "요청 취소" }).click();
  await expect(main.getByText("검수 요청 전입니다")).toBeVisible();
});

await step("resubmit", async () => {
  await page.getByRole("button", { name: "검수 요청" }).click();
  await page.getByRole("dialog", { name: "검수를 요청할까요?" }).getByRole("button", { name: "검수 요청" }).click();
  await expect(main.getByText("대표 검수자의 배정을 기다리고 있습니다")).toBeVisible();
});

let cloneId = "";
await step("clone", async () => {
  await page.getByRole("button", { name: "복제" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/requests/REQ-") && !u.pathname.endsWith(id));
  cloneId = page.url().split("/").pop();
  await expect(page.locator("main h1:visible")).toHaveText("M1 흐름 점검 (복제)");
  log(`clone ${cloneId}`);
});

await step("freeform draft: type change + uploads", async () => {
  await page.getByRole("tab", { name: /대시보드/ }).click();
  await page.getByRole("button", { name: /새 요청/ }).first().click();
  await page.waitForURL((u) => u.pathname.startsWith("/requests/REQ-") && !u.pathname.endsWith(cloneId));
  await main.getByLabel("유형").selectOption("FREEFORM");
  await expect(main.getByLabel("유형")).toHaveValue("FREEFORM");
  await main.getByRole("tab", { name: /콘텐츠/ }).click();
  await main.getByLabel("첨부파일 선택").setInputFiles([join(FILES, "약관 개정안.pdf"), join(FILES, "script.js"), join(FILES, "notes.txt")]);
  await expect(main.getByText(/약관 개정안\.pdf · 업로드 완료/)).toBeVisible();
  await expect(main.getByText(/script.js · 검사 실패 · 허용 형식/)).toBeVisible();
  await expect(main.getByText(/notes\.txt · 업로드 완료/)).toBeVisible();
  await main.getByLabel("첨부 검사 결과", { exact: true }).selectOption("UNSAFE");
  await main.getByLabel("첨부파일 선택").setInputFiles([join(FILES, "notes.txt")]);
  await expect(main.getByText(/notes\.txt · 안전하지 않은 파일로 등록 차단/).first()).toBeVisible();
  await main.getByLabel("약관 개정안.pdf 전체 분량").fill("14");
  await main.getByLabel("약관 개정안.pdf 실제 검수 범위").fill("20");
  await expect(main.getByText("검수 범위는 전체 분량 이내의 양의 정수")).toBeVisible();
  await main.getByLabel("약관 개정안.pdf 실제 검수 범위").fill("6");
  await saved();
  await main.getByRole("tab", { name: "교정" }).click();
  await expect(main.getByText(/첨부파일이 있는 자유입력형은 교정 실행/)).toBeVisible();
  const download = page.waitForEvent("download");
  await main.getByRole("button", { name: "약관 개정안.pdf 다운로드" }).click();
  log(`downloaded ${(await download).suggestedFilename()}`);
  await shot("10-freeform");
  await main.getByRole("button", { name: "notes.txt 삭제" }).click();
  await expect(main.getByRole("button", { name: "notes.txt 삭제" })).toHaveCount(0);
});

await step("rcs: type change with confirm + image", async () => {
  await main.getByRole("tab", { name: "요청 정보" }).click();
  await main.getByLabel("유형").selectOption("RCS");
  const dlg = page.getByRole("dialog", { name: "유형을 바꿀까요?" });
  await dlg.getByRole("button", { name: "유형 바꾸기" }).click();
  await main.getByRole("tab", { name: /콘텐츠/ }).click();
  await main.getByLabel("카드 수").selectOption("2");
  await main.getByLabel("첨부 검사 결과", { exact: true }).selectOption("SAFE");
  await main.getByLabel("카드 1 이미지 선택").setInputFiles(join(FILES, "card.png"));
  await expect(main.getByText("이미지 교체").first()).toBeVisible();
  await main.locator("textarea[data-path='cards.0.body']").fill("첫 카드 본문");
  await saved();
  await main.getByRole("tab", { name: "미리보기" }).click();
  await expect(main.locator("img[alt='']").first()).toBeVisible();
  await shot("11-rcs");
});

console.log(writes.join("\n"));
const clean = reportConsole();
await browser.close();
if (!clean) {
  log("FAIL browser console has unexplained errors");
  process.exit(1);
}
