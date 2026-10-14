/**
 * Assignment → review → approval flow against a running API in demo mode (creates one new request in
 * the dev DB per run; seed requests are not touched).
 *   node e2e/real/review-flow.mjs            (BASE=http://localhost:4246)
 * Personas (separate browser contexts): 김서연 u1 requester, 박지훈 u2 reviewer, 이도현 u3 lead,
 * 한가을 u6 reviewer, 최민아 u4 approver. Screenshots go to e2e/real/out (gitignored).
 */
import { expect } from "@playwright/test";
import {
  BASE,
  dialog,
  log,
  main,
  pick,
  pickDate,
  roundIs as round,
  startRun,
  statusIs as status,
  toastSeen,
} from "./helpers.mjs";

const { persona, step, shot, close } = await startRun("review");
const stamp = Date.now().toString(36);
const TITLE = `M2 검수 흐름 ${stamp}`;
let id = "";

const openRequest = async (page) => {
  await page.goto(`${BASE}/requests/${id}`);
  await expect(main(page).getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
};

/* ---------- requester creates and submits ---------- */

const u1 = await persona("u1", "김서연");
await step("u1 creates and submits a request", async () => {
  await u1.getByRole("button", { name: /새 요청/ }).first().click();
  await u1.waitForURL(/\/requests\/REQ-/);
  id = u1.url().split("/").pop();
  const m = main(u1);
  await m.getByLabel("제목").fill(TITLE);
  await pickDate(m.getByLabel("희망 납기"), "2026-10-30");
  await m.getByLabel("목적").fill("검수 흐름 확인");
  await m.getByLabel("대상 고객").fill("카드 보유 고객");
  await m.getByLabel("배경").fill("M2 점검");
  await m.getByRole("tab", { name: /콘텐츠/ }).click();
  await pick(m.getByLabel("승인 템플릿"), { index: 1 });
  await m.getByLabel("본문").fill("고객님, 10월 포인트가 적립되었습니다.");
  await expect(m.getByRole("status").filter({ hasText: /^저장됨/ }).first()).toBeVisible({ timeout: 10_000 });
  await u1.getByRole("button", { name: "검수 요청" }).click();
  await dialog(u1, "검수를 요청할까요?").getByRole("button", { name: "검수 요청" }).click();
  await toastSeen(u1, "검수를 요청했습니다");
  await status(u1, "배정 대기");
  log(`created ${id}`);
});

/* ---------- lead assigns from the 검수 screen ---------- */

const u3 = await persona("u3", "이도현");
await step("u3 assigns 박지훈 (primary) + 한가을 from 배정 관리", async () => {
  await u3.goto(`${BASE}/review`);
  const queue = u3.getByRole("region", { name: "배정 대기" });
  // the table row: its title opens the request, 배정 is the one row action
  await expect(queue.getByRole("button", { name: `${id} ${TITLE} 열기` })).toBeVisible();
  await shot(u3, "01-review-assign-u3");
  await queue.getByRole("button", { name: `${id} 배정`, exact: true }).click();
  await u3.waitForURL(new RegExp(`/requests/${id}$`));
  const d = dialog(u3, "검수자 배정");
  await d.getByRole("button", { name: "배정", exact: true }).click();
  await toastSeen(u3, "검수자를 한 명 이상 고르세요");
  await d.getByRole("checkbox", { name: /박지훈/ }).check();
  await expect(d.getByRole("radio", { name: "박지훈", checked: true })).toBeVisible();
  await d.getByRole("checkbox", { name: /한가을/ }).check();
  await d.getByRole("radio", { name: "박지훈", exact: true }).click();
  await shot(u3, "02-assign-modal");
  await d.getByRole("button", { name: "배정", exact: true }).click();
  await status(u3, "검수 중");
});

/* ---------- co-reviewer edits; the primary's stale save conflicts ---------- */

const u2 = await persona("u2", "박지훈");
const u6 = await persona("u6", "한가을");
await step("u2 opens the request (stale copy kept)", async () => {
  await openRequest(u2);
  await expect(main(u2).getByText("주담당 검수자입니다")).toBeVisible();
});
await step("u6 edits C1 (edit lock) and saves v2, adds an opinion", async () => {
  await openRequest(u6);
  const m = main(u6);
  await expect(m.getByText("공동 검수 중입니다")).toBeVisible();
  await m.getByLabel("본문").fill("고객님, 10월 포인트가 적립되었습니다. 확인해 보세요.");
  await expect(m.getByText("v1을 기준으로 수정 중입니다", { exact: false })).toBeVisible();
  await expect(m.getByText(/v1\s+수정 중/)).toBeVisible();
  await shot(u6, "03-buffer-u6");
  await m.getByRole("button", { name: "수정본 저장" }).click();
  await toastSeen(u6, "v2을 저장했습니다");
  await m.getByRole("tab", { name: /^의견/ }).click();
  await m.getByLabel("검수 의견 작성").fill("문장 끝에 행동 유도 문구를 추가했습니다.");
  await m.getByRole("button", { name: "의견 등록" }).click();
  await expect(m.getByText("문장 끝에 행동 유도 문구를 추가했습니다.")).toBeVisible();
});
await step("u2's open copy picks up v2 through the lock list (no stale edit)", async () => {
  // The light lock list (polled every 15s while 검수 중) shows C1 v2, so the detail is reloaded before
  // u2 edits on the old copy. (A lock answer with a newer version also drops a stale buffer — unit tested.)
  const m = main(u2);
  await expect(m.getByText("C1 v2", { exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(m.getByLabel("본문")).toHaveValue(/확인해 보세요/);
  await shot(u2, "04-latest-from-locks");
});
await step("lock shown to others; lead force-releases it", async () => {
  const m6 = main(u6);
  await m6.getByLabel("본문").fill("한가을 추가 수정 중");
  await expect(m6.getByText("v2을 기준으로 수정 중입니다", { exact: false })).toBeVisible();
  await u2.reload();
  await expect(main(u2).getByText("한가을 편집 중")).toBeVisible();
  await openRequest(u3);
  const bar = main(u3).getByText("한가을님이 이 문안을 편집 중입니다", { exact: false });
  await expect(bar).toBeVisible();
  await shot(u3, "05-lock-unlock-button");
  await main(u3).getByRole("button", { name: "잠금 해제 (대표 검수자)" }).click();
  await dialog(u3, /편집 잠금을 해제할까요\?$/).getByRole("button", { name: "잠금 해제" }).click();
  await expect(bar).toHaveCount(0);
  // The holder's buffer can no longer be saved; 변경 취소 drops it.
  await m6.getByRole("button", { name: "수정본 저장" }).click();
  await toastSeen(u6, "편집 잠금이 만료되었습니다");
  await m6.getByRole("button", { name: "변경 취소" }).click();
  await dialog(u6, /수정 내용을 버릴까요\?$/).getByRole("button", { name: "변경 취소" }).click();
  await expect(m6.getByText("v2을 기준으로 수정 중입니다", { exact: false })).toHaveCount(0);
});

/* ---------- opinion and 확인 요청 ---------- */

await step("u2 adds an opinion and asks the requester", async () => {
  await u2.reload();
  const m = main(u2);
  await m.getByRole("tab", { name: /^의견/ }).click();
  await m.getByLabel("검수 의견 작성").fill("혜택 기간을 본문에 명시해 주세요.");
  await m.getByRole("button", { name: "의견 등록" }).click();
  await expect(m.getByText("혜택 기간을 본문에 명시해 주세요.")).toBeVisible();
  await m.getByRole("tab", { name: /^확인 요청/ }).click();
  await m.getByLabel("요청자에게 확인 요청").fill("적립 기준일이 언제인가요?");
  await m.getByRole("button", { name: "확인 요청 보내기" }).click();
  await toastSeen(u2, "확인 요청을 보냈습니다");
  await status(u2, "확인 요청");
  await shot(u2, "06-ask-sent");
});

await step("u1 edits in 확인 요청, cannot answer before saving, then answers (round 2)", async () => {
  await openRequest(u1);
  const m = main(u1);
  await expect(m.getByText("검수자가 확인을 요청했습니다")).toBeVisible();
  await m.getByLabel("본문").fill("고객님, 10월 포인트(9/30 기준)가 적립되었습니다. 확인해 보세요.");
  await m.getByRole("button", { name: "답변하기" }).click();
  await m.getByLabel("답변").fill("9월 30일 기준입니다. 본문에 반영했습니다.");
  await m.getByRole("button", { name: "답변하고 검수 재개" }).click();
  await toastSeen(u1, "수정 중인 콘텐츠를 먼저 저장하세요");
  await m.getByRole("button", { name: "수정본 저장" }).click();
  await toastSeen(u1, "v3을 저장했습니다");
  await m.getByRole("button", { name: "답변하고 검수 재개" }).click();
  await toastSeen(u1, "답변을 보냈습니다");
  await status(u1, "검수 중");
  await round(u1, 2);
  await shot(u1, "07-answered");
});

/* ---------- assignment change ---------- */

await step("u3 changes the assignment (reason + handover required)", async () => {
  await openRequest(u3);
  await u3.getByRole("button", { name: "검수자 변경" }).click();
  const d = dialog(u3, "검수자 변경");
  await d.getByRole("checkbox", { name: /한가을/ }).uncheck();
  await d.getByRole("checkbox", { name: /이도현/ }).check();
  await d.getByRole("button", { name: "변경", exact: true }).click();
  await toastSeen(u3, "변경 사유을(를) 입력하세요");
  await d.getByLabel("변경 사유").fill("한가을 검수자 휴가");
  await d.getByLabel("인수인계 내용").fill("C1 문안은 v3까지 확인했습니다.");
  await shot(u3, "08-change-modal");
  await d.getByRole("button", { name: "변경", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(main(u3).getByText("박지훈, 이도현").first()).toBeVisible();
});

/* ---------- recall: rejected, then approved ---------- */

await step("u1 requests a recall; u2 rejects it", async () => {
  await u1.reload();
  await u1.getByRole("button", { name: "회수 요청" }).click();
  const d = dialog(u1, `${id} 요청의 회수를 요청할까요?`);
  await d.getByLabel("회수 사유").fill("캠페인 일정 변경");
  await d.getByRole("button", { name: "회수 요청" }).click();
  await expect(main(u1).getByText("회수 요청 처리 중입니다")).toBeVisible();
  await openRequest(u2);
  await expect(main(u2).getByText("김서연님이 회수를 요청했습니다")).toBeVisible();
  await shot(u2, "09-recall-banner");
  await main(u2).getByRole("button", { name: "거절", exact: true }).click();
  const r = dialog(u2, "회수를 거절할까요?");
  await r.getByLabel("처리 의견").fill("검수가 거의 끝났습니다");
  await r.getByRole("button", { name: "회수 거절" }).click();
  await expect(main(u2).getByText("김서연님이 회수를 요청했습니다")).toHaveCount(0);
});

await step("u1 requests again; u2 approves → draft, u2 leaves to 검수", async () => {
  await u1.reload();
  await u1.getByRole("button", { name: "회수 요청" }).click();
  const d = dialog(u1, `${id} 요청의 회수를 요청할까요?`);
  await d.getByLabel("회수 사유").fill("캠페인 일정 변경 확정");
  await d.getByRole("button", { name: "회수 요청" }).click();
  await u2.reload();
  await main(u2).getByRole("button", { name: "회수 승인" }).click();
  const r = dialog(u2, "회수를 승인할까요?");
  await r.getByLabel("처리 의견").fill("작성 중으로 돌려드립니다");
  await r.getByRole("button", { name: "회수 승인" }).click();
  await toastSeen(u2, "회수를 승인했습니다");
  await u2.waitForURL(/\/review$/);
});

await step("u1 resubmits (round + 1)", async () => {
  await u1.reload();
  await status(u1, "작성 중");
  await u1.getByRole("button", { name: "검수 요청" }).click();
  await dialog(u1, "검수를 요청할까요?").getByRole("button", { name: "검수 요청" }).click();
  await toastSeen(u1, "검수를 요청했습니다");
  await round(u1, 3);
});

await step("u3 assigns again from the request header (박지훈 primary + 이도현)", async () => {
  await openRequest(u3);
  await u3.getByRole("button", { name: "검수자 배정" }).click();
  const d = dialog(u3, "검수자 배정");
  for (const n of ["박지훈", "이도현"]) await d.getByRole("checkbox", { name: new RegExp(n) }).check();
  await d.getByRole("radio", { name: "박지훈", exact: true }).click();
  await pick(d.getByLabel("긴급도"), "URGENT");
  await d.getByRole("button", { name: "배정", exact: true }).click();
  await status(u3, "검수 중");
});

/* ---------- completion, approval ---------- */

async function complete() {
  await openRequest(u2);
  await u2.getByRole("button", { name: "검수 완료" }).click();
  const d = dialog(u2, "검수를 완료할까요?");
  const results = d.getByRole("region", { name: "공동 검수 결과" });
  await expect(results.getByText("박지훈 (주담당)")).toBeVisible();
  await expect(results.getByText("한가을 (이전 담당)")).toBeVisible();
  const ok = d.getByRole("button", { name: "검수 완료하고 승인 요청" });
  await expect(ok).toBeDisabled();
  await d.getByRole("checkbox", { name: "공동 검수 결과와 대상 버전을 확인했습니다" }).check();
  return { d, ok };
}

await step("u2 checks 내 검수 and completes (→ 승인 대기)", async () => {
  await u2.goto(`${BASE}/review`);
  await expect(main(u2).getByRole("row", { name: new RegExp(id) }).getByText("주담당")).toBeVisible();
  await shot(u2, "10-my-review-u2");
  const { ok } = await complete();
  await shot(u2, "11-complete-modal");
  await ok.click();
  await toastSeen(u2, "승인 대기로 넘겼습니다");
  await status(u2, "승인 대기");
});

const u4 = await persona("u4", "최민아");
await step("u4 sees the queue (처리 가능) and asks for a revision (round + 1)", async () => {
  await u4.goto(`${BASE}/approval`);
  const row = main(u4).getByRole("row", { name: new RegExp(id) });
  await expect(row.getByText("가능", { exact: true })).toBeVisible();
  await shot(u4, "12-approval-queue");
  await row.click();
  await expect(main(u4).getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await u4.getByRole("button", { name: "수정 요청" }).click();
  const d = dialog(u4, "수정 요청");
  await d.getByLabel("이유").fill("혜택 기간 문구가 빠졌습니다");
  await d.getByRole("button", { name: "수정 요청" }).click();
  await toastSeen(u4, "기대 내용을(를) 입력하세요");
  await d.getByLabel("세부 위치").fill("본문 첫 문장");
  await d.getByLabel("기대 내용").fill("혜택 기간을 명시");
  await d.getByRole("button", { name: "수정 요청" }).click();
  await status(u4, "검수 중");
  await round(u4, 4);
});

await step("u2 completes again", async () => {
  const { ok } = await complete();
  await ok.click();
  await toastSeen(u2, "승인 대기로 넘겼습니다");
});

await step("u4 approves → 승인 완료, result tab", async () => {
  await openRequest(u4);
  await main(u4).getByRole("button", { name: "승인", exact: true }).click();
  await dialog(u4, "최종 승인할까요?").getByRole("button", { name: "승인", exact: true }).click();
  await toastSeen(u4, "승인했습니다");
  await status(u4, "승인 완료");
  await main(u4).getByRole("tab", { name: "완료 결과" }).click();
  await shot(u4, "13-result");
  await u4.goto(`${BASE}/approval`);
  await expect(main(u4).getByRole("region", { name: /내가 처리한 요청/ }).getByText(id).or(main(u4).getByText(id)).first()).toBeVisible();
});

log(`done: ${id}`);
await close();
