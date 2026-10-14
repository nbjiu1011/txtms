/**
 * Shared helpers of the real-API flows (`review-flow.mjs`, `result-flow.mjs`): one browser, one
 * context per persona (signed in through the demo persona list), step runner that screenshots every
 * open page and exits on the first failure, and a small API client for setup steps that are not
 * under test (demo login → bearer token).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

export const BASE = process.env.BASE ?? "http://localhost:4246";
export const API = (process.env.API_ORIGIN ?? "http://localhost:4245") + "/api";
export const OUT = "e2e/real/out";

export const log = (m) => console.log(`- ${m}`);

/* ---------- browser console ---------- */

/** Console errors / warnings and uncaught page errors of every watched page. */
const consoleEntries = [];
/**
 * Messages a flow provokes on purpose: Chrome logs every refused API call (validation, conflicts, the
 * seed file 404, …) as "Failed to load resource" — the flows assert the refusals themselves. 5xx is never
 * expected.
 */
const EXPECTED_ERRORS = [/^Failed to load resource: the server responded with a status of 4\d\d/];

/** Collects console errors / warnings and page errors of `page` (and of the pages its context opens). */
export function watchConsole(page, label) {
  const watch = (p) => {
    p.on("console", (m) => {
      if (m.type() !== "error" && m.type() !== "warning") return;
      consoleEntries.push({ label, type: m.type(), text: m.text(), url: m.location()?.url ?? "" });
    });
    p.on("pageerror", (e) => consoleEntries.push({ label, type: "pageerror", text: e.message, url: "" }));
  };
  watch(page);
  page.context().on("page", watch);
}

/**
 * Prints the collected console output (expected refusals grouped by URL) and returns false when an error
 * or page error is not explained by `EXPECTED_ERRORS`. Warnings are listed but do not fail the run.
 */
export function reportConsole() {
  const unexplained = consoleEntries.filter(
    (e) => e.type !== "warning" && !EXPECTED_ERRORS.some((re) => re.test(e.text)),
  );
  const expected = consoleEntries.filter((e) => e.type === "error" && EXPECTED_ERRORS.some((re) => re.test(e.text)));
  const warnings = consoleEntries.filter((e) => e.type === "warning");
  const group = (list) => {
    const counts = new Map();
    for (const e of list) {
      const key = `${e.text.slice(0, 200)}${e.url ? ` @ ${e.url.replace(/^https?:\/\/[^/]+/, "")}` : ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].map(([k, n]) => `    ${n}× ${k}`);
  };
  log(`console: ${expected.length} expected API refusals, ${warnings.length} warnings, ${unexplained.length} unexplained errors`);
  for (const line of group(expected)) console.log(line);
  if (warnings.length) for (const line of group(warnings)) console.log(line);
  if (unexplained.length) for (const line of group(unexplained)) console.log(line);
  return unexplained.length === 0;
}

/**
 * Picks an option of a select (radix: the trigger is a `button[role=combobox]`, the list a portal `listbox`).
 * `choice`: an option value (`""` = the empty option), `{ label }` or `{ index }` — like `selectOption`.
 */
export async function pick(trigger, choice) {
  await trigger.click();
  const list = trigger.page().getByRole("listbox");
  const option =
    typeof choice === "string"
      ? list.locator(`[role="option"][data-value="${choice}"]`)
      : "label" in choice
        ? list.getByRole("option", { name: choice.label, exact: true })
        : list.getByRole("option").nth(choice.index);
  await option.click();
  await expect(list).toHaveCount(0);
}

/** Moves the open calendar to the month of `YYYY-MM-DD` (다음 달 / 이전 달) and clicks that day. */
async function clickDay(page, value) {
  const [year, month] = value.split("-").map(Number);
  for (let i = 0; i < 60; i++) {
    const grid = page.getByRole("grid").last();
    const [gy, gm] = ((await grid.getAttribute("aria-label")) ?? "").match(/\d+/g)?.map(Number) ?? [0, 0];
    if (gy === year && gm === month) return grid.locator(`[data-day="${value}"]`).click();
    await page.getByRole("button", { name: gy * 12 + gm < year * 12 + month ? "다음 달" : "이전 달" }).click();
  }
  throw new Error(`could not reach ${value}`);
}

/** Picks `YYYY-MM-DD` in a DatePicker (the field is a button that opens a calendar). */
export async function pickDate(trigger, value) {
  await trigger.click();
  await clickDay(trigger.page(), value);
}

/** Picks a period in a DateRangePicker: the start, then the end. */
export async function pickRange(trigger, from, to) {
  await trigger.click();
  await clickDay(trigger.page(), from);
  await clickDay(trigger.page(), to);
}

/** Selected value of a select trigger (radix select: the `data-value` attribute). */
export const selectValueIs = (trigger, value) => expect(trigger).toHaveAttribute("data-value", value);

/** Visible work tab panel of a page. */
export const main = (page) => page.locator("main [role=tabpanel]:visible");
export const dialog = (page, name) => page.getByRole("dialog", { name });
export const toastSeen = (page, text) =>
  expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
/** Status chip next to the request title. */
export const statusIs = (page, label) =>
  expect(main(page).locator("h1 ~ *").getByText(label, { exact: true }).first()).toBeVisible();
export const roundIs = (page, n) => expect(main(page).getByTitle("검수 차수")).toHaveText(`${n}차`);

/**
 * Starts a run: `prefix` names the screenshots (`{prefix}-{name}.png` in `e2e/real/out`).
 * `contextOptions` apply to every persona context (e.g. clipboard permissions).
 */
export async function startRun(prefix, contextOptions = {}) {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const pages = {};

  const shot = (page, name) => page.screenshot({ path: join(OUT, `${prefix}-${name}.png`) });

  async function persona(key, name) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      ...contextOptions,
    });
    const page = await context.newPage();
    watchConsole(page, key);
    page.setDefaultTimeout(15_000);
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    pages[key] = page;
    return page;
  }

  async function step(name, fn) {
    try {
      await fn();
      log(`OK  ${name}`);
    } catch (error) {
      log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
      for (const [key, page] of Object.entries(pages)) {
        await shot(page, `fail-${key}-${name.replace(/\W+/g, "-")}`).catch(() => {});
      }
      reportConsole();
      await browser.close();
      process.exit(1);
    }
  }

  /** Ends the run: the console report decides the exit code (unexplained errors fail the flow). */
  async function close() {
    const clean = reportConsole();
    await browser.close();
    if (!clean) {
      log("FAIL browser console has unexplained errors");
      process.exit(1);
    }
  }

  return { browser, pages, persona, step, shot, close };
}

/* ---------- API client for setup steps ---------- */

const tokens = new Map();

async function token(userId) {
  if (!tokens.has(userId)) {
    const res = await fetch(`${API}/auth/demo-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(`demo-login ${userId}: ${res.status}`);
    tokens.set(userId, (await res.json()).accessToken);
  }
  return tokens.get(userId);
}

/** JSON call as a demo persona; throws with the API message on an error status. */
export async function apiAs(userId, method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${await token(userId)}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json?.code ?? ""} ${json?.message ?? text}`);
  return json;
}

/** Demo personas of the 한빛카드 project 1. */
export const U = { requester: 1, reviewer: 2, lead: 3, approver: 4 };

const rowVersion = async (userId, id) => (await apiAs(userId, "GET", `/requests/${id}`)).rowVersion;

/**
 * Drives a submitted request (배정 대기) to 승인 완료 through the API: the lead assigns 박지훈 as the only
 * reviewer, he completes, 최민아 approves.
 */
export async function approveThroughApi(id) {
  await apiAs(U.lead, "POST", `/requests/${id}/assignment`, {
    reviewerIds: [U.reviewer],
    primaryReviewerId: U.reviewer,
    dueDate: "2026-12-31",
    rowVersion: await rowVersion(U.lead, id),
  });
  await apiAs(U.reviewer, "POST", `/requests/${id}/complete`, { rowVersion: await rowVersion(U.reviewer, id) });
  return apiAs(U.approver, "POST", `/requests/${id}/approve`, { rowVersion: await rowVersion(U.approver, id) });
}

/** Submits a draft as its requester through the API. */
export async function submitThroughApi(id, userId = U.requester) {
  return apiAs(
    userId,
    "POST",
    `/requests/${id}/submit`,
    { rowVersion: await rowVersion(userId, id) },
    { "Idempotency-Key": `e2e-${id}-${Date.now()}` },
  );
}
