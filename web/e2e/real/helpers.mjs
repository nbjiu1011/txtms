/**
 * Shared helpers of the real-API flows (`review-flow.mjs`, `result-flow.mjs`): one browser, one
 * context per persona (signed in through the demo persona list), step runner that screenshots every
 * open page and exits on the first failure, and a small API client for setup steps that are not
 * under test (demo login → bearer token).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

export const BASE = process.env.BASE ?? "http://localhost:3000";
export const API = (process.env.API_ORIGIN ?? "http://localhost:8080") + "/api";
export const OUT = "e2e/real/out";

export const log = (m) => console.log(`- ${m}`);

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
      await browser.close();
      process.exit(1);
    }
  }

  return { browser, pages, persona, step, shot, close: () => browser.close() };
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
