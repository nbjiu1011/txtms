import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { CORRECTION_DATASETS } from "../fixtures/correction-snapshot";
import { mockApiAs } from "../fixtures/mock-api";
import { API_SNAPSHOT } from "../fixtures/api-snapshot";
import { REVIEW_SNAPSHOT } from "../fixtures/review-snapshot";
import type { RequestDetail } from "@/entities/request";
import { PROTOTYPE_URL, compareSizes, compose, settle, sizeSuffix } from "./fixtures";

const OUT = join(__dirname, "out");

/** Prototype persona ids (`u1`…) → API user ids of the demo seed. */
const USER_ID: Record<string, number> = { u2: 2, u3: 3, u4: 4 };

interface Screen {
  name: string;
  persona: keyof typeof USER_ID;
  path: string;
  /** App interaction after load. */
  app?: (page: Page) => Promise<void>;
  /** Prototype script after persona login. */
  proto: string;
  /** Screenshot of the open modal only (both sides) instead of the viewport. */
  modal?: boolean;
  /** Extra mocked GET responses (win over the snapshot). */
  extra?: Record<string, unknown>;
}

/**
 * A seed request without edit locks (detail + lock list). The seed gives 한가을 a lock on REQ-2609-101 C2
 * that is valid for 30 minutes after seeding, so a fresh capture shows it.
 */
function withoutLocks(userId: number, id: string): Record<string, unknown> {
  const path = `/requests/${id}`;
  const detail = (REVIEW_SNAPSHOT[userId]?.[path] ?? API_SNAPSHOT[userId]?.[path]) as RequestDetail;
  const contents = detail.contents.map((c) => ({ ...c, lock: null }));
  return {
    [`/requests/${id}`]: { ...detail, contents },
    [`/requests/${id}/locks`]: contents.map((c) => ({
      contentKey: c.key,
      userId: null,
      lockedAt: null,
      expiresAt: null,
      version: c.version,
    })),
  };
}

const nav = (r: string) => `A.nav({dataset:{r:'${r}'}});`;
const openReq = (id: string) => `A.openReq({dataset:{id:'${id}'}});`;

const SCREENS: Screen[] = [
  { name: "review-u3-assign", persona: "u3", path: "/review", proto: nav("review") },
  {
    name: "review-u3-mine",
    persona: "u3",
    path: "/review",
    app: (p) => p.getByRole("tab", { name: "내 검수" }).click(),
    proto: `${nav("review")}A.sub({dataset:{k:'mine'}});`,
  },
  { name: "review-u2-mine", persona: "u2", path: "/review", proto: nav("review") },
  { name: "approval-u4", persona: "u4", path: "/approval", proto: nav("approval") },
  {
    name: "assign-modal-u3",
    persona: "u3",
    path: "/requests/REQ-2609-104",
    app: (p) => p.getByRole("button", { name: "검수자 배정" }).click(),
    proto: `${openReq("REQ-2609-104")}A.assign({dataset:{}});`,
    modal: true,
  },
  {
    name: "change-modal-u3",
    persona: "u3",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("button", { name: "검수자 변경" }).click(),
    proto: `${openReq("REQ-2609-101")}A.assign({dataset:{change:'1'}});`,
    modal: true,
  },
  {
    name: "complete-modal-u2",
    persona: "u2",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("button", { name: "검수 완료" }).click(),
    // Without 한가을's seed edit lock on both sides (a lock blocks 검수 완료 with a toast).
    proto: `S.requests.find((r) => r.id === 'REQ-2609-101').contents.forEach((c) => { c.lockBy = null; });${openReq("REQ-2609-101")}A.complete();`,
    modal: true,
    extra: withoutLocks(2, "REQ-2609-101"),
  },
];

/**
 * 검수 / 승인 screens and the assignment / completion modals next to the prototype as the same
 * persona (API mocked from the demo seed). Intended differences: today's date, due-date tags
 * computed by the server (the prototype pins "today" to 9월 21일), menus of screens not built yet.
 */
for (const size of compareSizes())
for (const screen of SCREENS) {
  test(`review ${screen.name}${sizeSuffix(size)}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const viewport = { width: size.width, height: size.height };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.reload();
    await proto.locator(`.persona[data-u="${screen.persona}"]`).click();
    await proto.locator("#app").waitFor();
    await proto.evaluate(screen.proto);
    await settle(proto);
    const protoPng = screen.modal ? await proto.locator(".modal").screenshot() : await proto.screenshot();

    const app = await context.newPage();
    await mockApiAs(app, USER_ID[screen.persona], {
      extra: { ...CORRECTION_DATASETS, ...REVIEW_SNAPSHOT[USER_ID[screen.persona]], ...screen.extra },
    });
    await app.goto(screen.path);
    await app.locator("main h1").first().waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await app.waitForTimeout(400);
    if (screen.app) await screen.app(app);
    await app.waitForTimeout(400);
    await settle(app);
    const appPng = screen.modal ? await app.getByRole("dialog").screenshot() : await app.screenshot();

    const base = `review-${screen.name}${sizeSuffix(size)}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% differing pixels`);
    await context.close();
  });
}
