import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { mockApiAs } from "../fixtures/mock-api";
import { REVIEW_SNAPSHOT } from "../fixtures/review-snapshot";
import { PROTOTYPE_URL, compose, settle } from "./fixtures";

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
    // The seed's edit lock of 한가을 is long expired on the server; release it in the prototype too.
    proto: `S.requests.find((r) => r.id === 'REQ-2609-101').contents.forEach((c) => { c.lockBy = null; });${openReq("REQ-2609-101")}A.complete();`,
    modal: true,
  },
];

/**
 * 검수 / 승인 screens and the assignment / completion modals next to the prototype as the same
 * persona (API mocked from the demo seed). Intended differences: today's date, due-date tags
 * computed by the server (the prototype pins "today" to 9월 21일), menus of screens not built yet.
 */
for (const screen of SCREENS) {
  test(`review ${screen.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const viewport = { width: 1440, height: 900 };
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
    await mockApiAs(app, USER_ID[screen.persona], { extra: REVIEW_SNAPSHOT[USER_ID[screen.persona]] });
    await app.goto(screen.path);
    await app.locator("main h1").first().waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await app.waitForTimeout(400);
    if (screen.app) await screen.app(app);
    await app.waitForTimeout(400);
    await settle(app);
    const appPng = screen.modal ? await app.getByRole("dialog").screenshot() : await app.screenshot();

    const base = `review-${screen.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% differing pixels`);
    await context.close();
  });
}
