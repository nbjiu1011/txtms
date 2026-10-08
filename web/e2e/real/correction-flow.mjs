/**
 * Text correction (M4) against a running API in demo mode.
 *   node e2e/real/correction-flow.mjs        (BASE=http://localhost:4246, API_ORIGIN=http://localhost:4245)
 * 김서연 on the seed draft REQ-2609-105 (할수 → 할 수, autosave, restore) and on a fresh draft built from
 * sample-dataset phrases (1:N swap / restore, overlapping results, description-only, card → editor
 * selection, stale banner, 전체 검사 with the bottom bar, 건의하기); 박지훈 on REQ-2609-101 (edit lock +
 * revision buffer → 수정본 저장, the seed text is put back through the API afterwards); 김서연 read-only on
 * REQ-2609-101; a 자유입력형 with an attachment (results dropped, excluded from 전체 검사); 문지아 (customer
 * 2, no 자유입력형 dataset) gets the server's "not assigned" message. Screenshots: e2e/real/out.
 */
import { join } from "node:path";
import { expect } from "@playwright/test";
import { BASE, U, apiAs, dialog, main, startRun, toastSeen } from "./helpers.mjs";

const FILES = "e2e/real/files";
const { persona, step, shot, close } = await startRun("correction");
const stamp = Date.now().toString(36);

const panel = (page) => main(page).getByRole("complementary", { name: "콘텐츠 보조 패널" });
const editorField = (page, path = "body") => main(page).locator(`section[aria-label="콘텐츠 편집"] [data-path="${path}"]`);
const card = (page, matched) => panel(page).getByRole("article", { name: new RegExp(` ${matched} 교정 결과$`) });
/** Content list item (role=button) whose text contains `text`. */
const item = (page, text) =>
  main(page).getByRole("complementary", { name: "콘텐츠 목록" }).getByRole("button").filter({ hasText: text }).first();
const openRequest = async (page, id) => {
  await page.goto(`${BASE}/requests/${id}`);
  await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
};
const payloadOf = async (userId, id, key = "C1") =>
  (await apiAs(userId, "GET", `/requests/${id}`)).contents.find((c) => c.key === key).payload;
const historyOf = (userId, id) => apiAs(userId, "GET", `/requests/${id}/history`);
async function eventually(fn, what, timeout = 10_000) {
  const until = Date.now() + timeout;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > until) throw new Error(`timed out: ${what}${what.startsWith("selection") ? ` (now ${JSON.stringify(await selection(u1))})` : ""}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}
/** Selection of the focused editor control. */
const selection = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el && "selectionStart" in el ? [el.dataset.path, el.selectionStart, el.selectionEnd] : null;
  });

const u1 = await persona("u1", "김서연");

/* ---------- 1. seed draft REQ-2609-105: 1:1 apply → autosave → restore ---------- */
const SEED = "REQ-2609-105";
await step("seed draft holds 할수 (reset through the API when an earlier run left it applied)", async () => {
  const p = await payloadOf(U.requester, SEED);
  if (!p.body.includes("할수")) {
    await apiAs(U.requester, "PUT", `/requests/${SEED}/contents/C1`, { payload: { ...p, body: p.body.replace("할 수", "할수") } });
  }
  await openRequest(u1, SEED);
  await expect(panel(u1).getByText(/교정 데이터셋 · 알림톡 v\d+/)).toBeVisible();
  await expect(panel(u1).getByText("교정 실행은 검수 요청·완료 조건이 아닙니다.")).toBeVisible();
  await expect(panel(u1).getByText("아직 검사하지 않았습니다.")).toBeVisible();
});
await step("이 콘텐츠 검사 → 할수 card (1:1 button, 복원 disabled)", async () => {
  await panel(u1).getByRole("button", { name: "이 콘텐츠 검사" }).click();
  await expect(card(u1, "할수")).toBeVisible();
  await expect(card(u1, "할수").getByRole("button", { name: "할수(으)로 복원" })).toBeDisabled();
  await expect(card(u1, "할수").getByText("띄어쓰기")).toBeVisible();
  await shot(u1, "seed-checked");
});
await step("할 수 applies at once: toast, text selected in the editor, autosaved, history 교정 적용", async () => {
  await card(u1, "할수").getByRole("button", { name: "할 수", exact: true }).click();
  await toastSeen(u1, "교정이 적용되었습니다.");
  await expect(editorField(u1)).toHaveValue(/할 수 있습니다/);
  const value = await editorField(u1).inputValue();
  const at = value.indexOf("할 수");
  await eventually(async () => JSON.stringify(await selection(u1)) === JSON.stringify(["body", at, at + 3]), "editor selection");
  await expect(card(u1, "할수").getByRole("button", { name: "할 수", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card(u1, "할수").getByRole("button", { name: "할수(으)로 복원" })).toBeEnabled();
  await eventually(async () => (await payloadOf(U.requester, SEED)).body.includes("할 수 있습니다"), "autosave of the applied text");
  await eventually(
    async () => (await historyOf(U.requester, SEED)).some((h) => h.action === "교정 적용" && /^body: 할수 → 할 수 \(.+\)$/.test(h.detail)),
    "history 교정 적용",
  );
  await shot(u1, "seed-applied");
});
await step("복원 returns the original: toast 교정이 취소되었습니다., autosaved, history 교정 복원", async () => {
  await card(u1, "할수").getByRole("button", { name: "할수(으)로 복원" }).click();
  await toastSeen(u1, "교정이 취소되었습니다.");
  await expect(editorField(u1)).toHaveValue(/할수 있습니다/);
  await expect(card(u1, "할수").getByRole("button", { name: "할수(으)로 복원" })).toBeDisabled();
  await eventually(async () => (await payloadOf(U.requester, SEED)).body.includes("할수 있습니다"), "autosave of the restore");
  await eventually(async () => (await historyOf(U.requester, SEED)).some((h) => h.action === "교정 복원"), "history 교정 복원");
});

/* ---------- 2. a draft with sample-dataset phrases ---------- */
const C1_BODY = [
  "가입 대상인지 아닌지 확인하세요.",
  "수령인 성함을 적어 주세요.",
  "카드 발송은 영업일 기준 일주일 이상 소요됩니다.",
  "첫번째 보장 받겠지만 처리됩니다.",
].join("\n");
const C2_BODY = `${stamp} 참여는 지금 할수 있습니다.`;
let draft = "";
await step("API: new 알림톡 draft with two contents of sample phrases", async () => {
  const created = await apiAs(U.requester, "POST", "/requests", { projectId: 1, type: "ALIMTALK" });
  draft = created.id;
  await apiAs(U.requester, "PATCH", `/requests/${draft}`, { title: `M4 교정 ${stamp}` });
  await apiAs(U.requester, "PUT", `/requests/${draft}/contents/C1`, {
    title: "교정 샘플",
    payload: { templateCode: "", body: C1_BODY, buttons: [] },
  });
  const c2 = await apiAs(U.requester, "POST", `/requests/${draft}/contents`, { title: "두 번째" });
  await apiAs(U.requester, "PUT", `/requests/${draft}/contents/${c2.key}`, {
    payload: { templateCode: "", body: C2_BODY, buttons: [] },
  });
  await openRequest(u1, draft);
  await panel(u1).getByRole("button", { name: "이 콘텐츠 검사" }).click();
  await expect(card(u1, "가입 대상")).toBeVisible();
  await shot(u1, "sample-checked");
});
const select = (matched) => card(u1, matched).getByRole("combobox", { name: `${matched} 권장 표현 선택` });
await step("scenario 2: 가입 대상 → 가입대상 → 가입 가능한 분 (direct swap), label/description follow", async () => {
  await expect(select("가입 대상")).toHaveValue("");
  await select("가입 대상").selectOption({ label: "가입대상" });
  await toastSeen(u1, "교정이 적용되었습니다.");
  await expect(editorField(u1)).toHaveValue(/^가입대상인지/);
  await expect(card(u1, "가입 대상").getByText("띄어쓰기")).toBeVisible();
  await select("가입 대상").selectOption({ label: "가입 가능한 분" });
  await expect(editorField(u1)).toHaveValue(/^가입 가능한 분인지/);
  await expect(card(u1, "가입 대상").getByText("혼용어")).toBeVisible();
  await expect(card(u1, "가입 대상").getByRole("button", { name: "가입 대상(으)로 복원" })).toBeEnabled();
});
await step("scenario 12: 소요됩니다 → 필요합니다 → 걸립니다 → 복원 = 소요됩니다 (indexes intact after the earlier swap)", async () => {
  await select("소요됩니다").selectOption({ label: "필요합니다" });
  await expect(editorField(u1)).toHaveValue(/일주일 이상 필요합니다\./);
  await select("소요됩니다").selectOption({ label: "걸립니다" });
  await expect(editorField(u1)).toHaveValue(/일주일 이상 걸립니다\./);
  await card(u1, "소요됩니다").getByRole("button", { name: "소요됩니다(으)로 복원" }).click();
  await toastSeen(u1, "교정이 취소되었습니다.");
  await expect(editorField(u1)).toHaveValue(/일주일 이상 소요됩니다\./);
  await expect(select("소요됩니다")).toHaveValue("");
});
await step("scenario 8: 수령인 → 받는 사람 → 받는 분, then 가입 대상 restored → original lines", async () => {
  await select("수령인").selectOption({ label: "받는 사람" });
  await select("수령인").selectOption({ label: "받는 분" });
  await card(u1, "가입 대상").getByRole("button", { name: "가입 대상(으)로 복원" }).click();
  await expect(editorField(u1)).toHaveValue(C1_BODY.replace("수령인", "받는 분"));
  await card(u1, "수령인").getByRole("button", { name: "수령인(으)로 복원" }).click();
  await expect(editorField(u1)).toHaveValue(C1_BODY);
  await eventually(async () => (await payloadOf(U.requester, draft)).body === C1_BODY, "autosave back to the original");
});
await step("overlapping results: 첫번째 보장 applied disables 보장 받겠지만 until restored; 처리 is description-only", async () => {
  await card(u1, "첫번째 보장").getByRole("button", { name: "첫 보장", exact: true }).click();
  await expect(card(u1, "보장 받겠지만").getByRole("button", { name: "보장받겠지만", exact: true })).toBeDisabled();
  await expect(card(u1, "보장 받겠지만").getByText(/겹치는 교정\(첫번째 보장\)/)).toBeVisible();
  await shot(u1, "sample-overlap");
  await card(u1, "첫번째 보장").getByRole("button", { name: "첫번째 보장(으)로 복원" }).click();
  await card(u1, "보장 받겠지만").getByRole("button", { name: "보장받겠지만", exact: true }).click();
  await expect(editorField(u1)).toHaveValue(/첫번째 보장받겠지만 처리됩니다/);
  await card(u1, "보장 받겠지만").getByRole("button", { name: "보장 받겠지만(으)로 복원" }).click();
  await expect(card(u1, "처리")).toBeVisible();
  await expect(card(u1, "처리").getByRole("button", { name: /복원/ })).toHaveCount(0);
  await expect(card(u1, "처리").getByText("교정 이유")).toBeVisible();
});
await step("card click and Enter select the expression in the editor", async () => {
  await card(u1, "수령인").getByText("기존 표현").click();
  const at = C1_BODY.indexOf("수령인");
  await eventually(async () => JSON.stringify(await selection(u1)) === JSON.stringify(["body", at, at + 3]), "selection on click");
  await card(u1, "소요됩니다").focus();
  await u1.keyboard.press("Enter");
  const at2 = C1_BODY.indexOf("소요됩니다");
  await eventually(async () => JSON.stringify(await selection(u1)) === JSON.stringify(["body", at2, at2 + 5]), "selection on Enter");
});
await step("typing after the check shows the stale banner and disables apply; re-check clears it", async () => {
  await editorField(u1).press("End");
  await editorField(u1).pressSequentially("!");
  await expect(panel(u1).getByText("최신 내용과 불일치 · 문안, 변수 또는 연결값이 바뀌었습니다. 다시 검사하세요.")).toBeVisible();
  await expect(card(u1, "첫번째 보장").getByRole("button", { name: "첫 보장", exact: true })).toBeDisabled();
  await shot(u1, "sample-stale");
  await panel(u1).getByRole("button", { name: "이 콘텐츠 검사" }).click();
  await expect(panel(u1).getByText(/최신 내용과 불일치/)).toHaveCount(0);
});
await step("전체 검사: groups per content, bottom bar counts, apply in C2 switches the editor, 교정 완료 closes", async () => {
  await panel(u1).getByRole("button", { name: "전체 검사 2건" }).click();
  await expect(panel(u1).getByRole("button", { name: /^C1 · 교정 샘플/ })).toBeVisible();
  await expect(panel(u1).getByRole("button", { name: /^C2 · 두 번째/ })).toContainText("(1)");
  await expect(panel(u1).getByText(/^교정 적용/)).toHaveText("교정 적용 0");
  await shot(u1, "bulk");
  await card(u1, "할수").getByRole("button", { name: "할 수", exact: true }).click();
  await toastSeen(u1, "교정이 적용되었습니다.");
  await expect(editorField(u1)).toHaveValue(C2_BODY.replace("할수", "할 수"));
  await expect(item(u1, "두 번째")).toHaveAttribute("aria-pressed", "true");
  await expect(panel(u1).getByText(/^교정 적용/)).toHaveText("교정 적용 1");
  await eventually(async () => (await payloadOf(U.requester, draft, "C2")).body.includes("할 수"), "C2 autosave");
  await panel(u1).getByRole("button", { name: /^C1 · 교정 샘플/ }).click();
  await expect(card(u1, "가입 대상")).toHaveCount(0);
  await shot(u1, "bulk-applied");
  await panel(u1).getByRole("button", { name: "교정 완료" }).click();
  await expect(panel(u1).getByRole("button", { name: "교정 완료" })).toHaveCount(0);
  await expect(panel(u1).getByText("C2 · 두 번째")).toBeVisible();
});
await step("④ 건의하기: reason required, sent with the matched text → toast, history 교정 건의", async () => {
  await card(u1, "할수").getByRole("button", { name: "건의하기" }).click();
  const dlg = dialog(u1, "교정 건의하기");
  await expect(dlg.getByText("할수", { exact: true })).toBeVisible();
  await dlg.getByRole("button", { name: "건의 보내기" }).click();
  await toastSeen(u1, "건의 이유을(를) 입력하세요");
  await dlg.getByRole("textbox", { name: /건의 이유/ }).fill(`문맥에 따라 '할 수가'도 권장해 주세요 ${stamp}`);
  await shot(u1, "suggestion");
  await dlg.getByRole("button", { name: "건의 보내기" }).click();
  await toastSeen(u1, "건의를 보냈습니다");
  await expect(dlg).toHaveCount(0);
  await eventually(
    async () => (await historyOf(U.requester, draft)).some((h) => h.action === "교정 건의" && h.detail.includes(stamp)),
    "history 교정 건의",
  );
});

/* ---------- 3. read-only viewer and reviewer on REQ-2609-101 ---------- */
const REVIEW = "REQ-2609-101";
const original = await payloadOf(U.reviewer, REVIEW);
await step("요청자 on a request in review: can check, cannot apply or suggest", async () => {
  await openRequest(u1, REVIEW);
  await panel(u1).getByRole("button", { name: "이 콘텐츠 검사" }).click();
  await expect(card(u1, "클릭")).toBeVisible();
  await expect(card(u1, "클릭").getByRole("button", { name: "선택", exact: true })).toBeDisabled();
  await expect(card(u1, "클릭").getByRole("button", { name: "건의하기" })).toBeDisabled();
  await shot(u1, "readonly");
});
const u2 = await persona("u2", "박지훈");
let base = 0;
try {
  await step("검수자: apply takes the edit lock and fills the revision buffer", async () => {
    base = (await apiAs(U.reviewer, "GET", `/requests/${REVIEW}`)).contents[0].version;
    await openRequest(u2, REVIEW);
    await panel(u2).getByRole("button", { name: "이 콘텐츠 검사" }).click();
    await card(u2, "되요").getByRole("button", { name: "돼요", exact: true }).click();
    await toastSeen(u2, "교정이 적용되었습니다.");
    await expect(main(u2).getByText(`v${base}을 기준으로 수정 중입니다`, { exact: false })).toBeVisible();
    await expect(editorField(u2)).toHaveValue(/적립 돼요/);
    const detail = await apiAs(U.reviewer, "GET", `/requests/${REVIEW}`);
    if (detail.contents[0].lock?.userId !== U.reviewer) throw new Error("no edit lock for 박지훈");
    await shot(u2, "review-applied");
  });
  await step("수정본 저장 → new version with the corrected text, history 교정 적용", async () => {
    await main(u2).getByRole("button", { name: "수정본 저장" }).click();
    await toastSeen(u2, `v${base + 1}을 저장했습니다`);
    const c1 = (await apiAs(U.reviewer, "GET", `/requests/${REVIEW}`)).contents[0];
    if (c1.version !== base + 1 || !c1.payload.body.includes("적립 돼요")) throw new Error(`saved ${c1.version}`);
    const history = await historyOf(U.reviewer, REVIEW);
    if (!history.some((h) => h.action === "교정 적용" && /^body: 되요 → 돼요 \(.+\)$/.test(h.detail))) throw new Error("no 교정 적용 history");
    await shot(u2, "review-saved");
  });
} finally {
  // Keep the seed text for later runs: a revision with the original payload (needs the lock).
  const now = await apiAs(U.reviewer, "GET", `/requests/${REVIEW}`);
  if (JSON.stringify(now.contents[0].payload) !== JSON.stringify(original)) {
    await apiAs(U.reviewer, "POST", `/requests/${REVIEW}/contents/C1/lock`);
    await apiAs(U.reviewer, "POST", `/requests/${REVIEW}/contents/C1/revisions`, {
      baseVersion: now.contents[0].version,
      payload: original,
    });
    console.log(`- (cleanup) ${REVIEW} C1 text restored as v${now.contents[0].version + 1}`);
  }
}

/* ---------- 4. 자유입력형 with an attachment ---------- */
let freeform = "";
await step("자유입력형: results are dropped once a file is attached; the content is excluded", async () => {
  const created = await apiAs(U.requester, "POST", "/requests", { projectId: 1, type: "FREEFORM" });
  freeform = created.id;
  await apiAs(U.requester, "PATCH", `/requests/${freeform}`, { title: `M4 자유입력 ${stamp}` });
  await apiAs(U.requester, "PUT", `/requests/${freeform}/contents/C1`, { payload: { title: "", text: "지금 할수 있습니다" } });
  const c2 = await apiAs(U.requester, "POST", `/requests/${freeform}/contents`, { title: "본문만" });
  await apiAs(U.requester, "PUT", `/requests/${freeform}/contents/${c2.key}`, { payload: { title: "", text: "수령인 확인" } });
  await openRequest(u1, freeform);
  await panel(u1).getByRole("button", { name: "이 콘텐츠 검사" }).click();
  await expect(card(u1, "할수")).toBeVisible();
  await main(u1).getByLabel("첨부파일 선택").setInputFiles([join(FILES, "notes.txt")]);
  await expect(panel(u1).getByText(/첨부파일이 있는 자유입력형은 교정 실행·결과가 비활성화되며/)).toBeVisible({ timeout: 15_000 });
  await expect(panel(u1).getByRole("button", { name: "이 콘텐츠 검사" })).toBeDisabled();
  await shot(u1, "freeform-excluded");
});
await step("자유입력형: 전체 검사 1건 lists C1 as excluded", async () => {
  await panel(u1).getByRole("button", { name: "전체 검사 1건" }).click();
  // the current content is excluded → only the note; switch to C2 to see the grouped result
  await item(u1, "본문만").click();
  await expect(panel(u1).getByText("C1 · 첨부파일로 제외")).toBeVisible();
  await expect(card(u1, "수령인")).toBeVisible();
  await shot(u1, "freeform-bulk");
});
await step("removing the attachment does not bring the old result back", async () => {
  await item(u1, "C1").click();
  await main(u1).getByRole("button", { name: "notes.txt 삭제" }).click();
  await toastSeen(u1, "첨부파일이 없어 텍스트 교정을 다시 쓸 수 있습니다");
  await panel(u1).getByRole("button", { name: "교정 완료" }).click();
  await expect(panel(u1).getByText("아직 검사하지 않았습니다.")).toBeVisible();
  await expect(panel(u1).getByRole("button", { name: "이 콘텐츠 검사" })).toBeEnabled();
});

/* ---------- 5. customer 2 without a 자유입력형 dataset ---------- */
const u9 = await persona("u9", "문지아");
await step("고객사 2 자유입력형: 배정 필요 and the server message on click", async () => {
  const drafts = await apiAs(9, "GET", "/requests?projectId=3&view=MY_DRAFT&size=50");
  let target = drafts.content.find((r) => r.type === "FREEFORM")?.id;
  if (!target) target = (await apiAs(9, "POST", "/requests", { projectId: 3, type: "FREEFORM" })).id;
  await openRequest(u9, target);
  await main(u9).getByRole("tab", { name: /콘텐츠/ }).click();
  await expect(panel(u9).getByText("배정 필요")).toBeVisible();
  const button = panel(u9).getByRole("button", { name: "이 콘텐츠 검사" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await button.click({ force: true }); // aria-disabled (still clickable: it explains why)
  await toastSeen(u9, "유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요");
  await shot(u9, "unassigned");
});

console.log(`- requests: ${draft}, ${freeform}`);
await close();
