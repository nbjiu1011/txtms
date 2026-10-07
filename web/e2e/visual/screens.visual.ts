import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { ARCHIVE_EXTRA_U1 } from "../fixtures/archive-snapshot";
import { CHECK_101, CORRECTION_DATASETS } from "../fixtures/correction-snapshot";
import { mockApiAs, type MockWrite } from "../fixtures/mock-api";
import { PROTOTYPE_URL, compose, settle } from "./fixtures";

const OUT = join(__dirname, "out");

/** Prototype persona ids (`u1`…) → API user ids of the demo seed. */
const USER_ID: Record<string, number> = { u1: 1, u2: 2, u3: 3, u4: 4, u11: 11 };

interface Screen {
  name: string;
  persona: keyof typeof USER_ID;
  /** App URL. */
  path: string;
  /** App interaction after load (sub tabs, side panel tabs). */
  app?: (page: Page) => Promise<void>;
  /** Prototype script after persona login (opens the same screen). */
  proto?: string;
  /** Scroll of `main` in both, to compare the lower part of a long screen. */
  scroll?: number;
  /** Extra mocked GET responses. */
  extra?: Record<string, unknown>;
  /** Mocked write calls. */
  onWrite?: (write: MockWrite) => { status: number; body?: unknown } | undefined;
}

/** 이 콘텐츠 검사 of REQ-2609-101 answers with the captured result of the requested contents. */
const checkWrite = (w: MockWrite) => {
  if (!w.path.endsWith("/corrections/check")) return undefined;
  const keys = (w.body as { contents: { contentKey: string }[] }).contents.map((c) => c.contentKey);
  return { status: 200, body: { results: CHECK_101.results.filter((r) => keys.includes(r.contentKey)) } };
};

const openReq = (id: string) => `A.openReq({dataset:{id:'${id}'}});`;

const SCREENS: Screen[] = [
  { name: "dashboard-u1", persona: "u1", path: "/" },
  { name: "dashboard-u3", persona: "u3", path: "/" },
  { name: "dashboard-u11", persona: "u11", path: "/" },
  { name: "requests-u1", persona: "u1", path: "/requests", proto: "A.nav({dataset:{r:'requests'}});" },
  { name: "request-101-u2", persona: "u2", path: "/requests/REQ-2609-101", proto: openReq("REQ-2609-101") },
  {
    // Correction cards follow the 화면설계 PNG (261007), not the prototype card: compared for the frame
    // (panel head, dataset line) and kept as a capture of the PNG-style cards.
    name: "request-101-u2-proof-checked",
    persona: "u2",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("button", { name: "이 콘텐츠 검사" }).click(),
    proto: `${openReq("REQ-2609-101")}A.check();`,
    onWrite: checkWrite,
  },
  {
    name: "request-101-u2-preview",
    persona: "u2",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("tab", { name: "미리보기" }).click(),
    proto: `${openReq("REQ-2609-101")}A.spTab({dataset:{k:'mock'}});`,
    scroll: 150,
  },
  {
    name: "request-101-u2-opinions",
    persona: "u2",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("tab", { name: "의견 1" }).click(),
    proto: `${openReq("REQ-2609-101")}A.spTab({dataset:{k:'op'}});`,
    scroll: 150,
  },
  {
    name: "request-101-u2-history",
    persona: "u2",
    path: "/requests/REQ-2609-101",
    app: (p) => p.getByRole("tab", { name: /히스토리/ }).click(),
    proto: `${openReq("REQ-2609-101")}A.sub({dataset:{k:'hist'}});`,
  },
  { name: "request-103-u4", persona: "u4", path: "/requests/REQ-2609-103", proto: openReq("REQ-2609-103") },
  {
    name: "request-088-u1-result",
    persona: "u1",
    path: "/requests/REQ-2609-088",
    app: (p) => p.getByRole("tab", { name: "완료 결과" }).click(),
    proto: `${openReq("REQ-2609-088")}A.sub({dataset:{k:'result'}});`,
  },
  {
    name: "contents-u1",
    persona: "u1",
    path: "/contents",
    proto: "A.nav({dataset:{r:'contents'}});",
    extra: ARCHIVE_EXTRA_U1,
  },
  {
    name: "contents-u1-expanded",
    persona: "u1",
    path: "/contents",
    app: (p) => p.getByRole("button", { name: "이력 1" }).click(),
    proto: "A.nav({dataset:{r:'contents'}});A.lineToggle({dataset:{k:'REQ-2609-088:C1'}});",
    extra: ARCHIVE_EXTRA_U1,
  },
];

async function scrollMain(page: Page, top: number) {
  await page.evaluate((y) => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = y;
  }, top);
}

/**
 * Read-only workflow screens next to the prototype logged in as the same persona. Intended
 * differences: today's date (the prototype hard-codes 9월 21일), menus of screens that are not
 * built yet, action buttons whose flows come in later milestones, editors shown read-only, the
 * prototype-only "기능 대응표" / "첨부 검사 시연" UI, and variable values in previews (variables API).
 */
for (const screen of SCREENS) {
  test(`screen ${screen.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const viewport = { width: 1440, height: 900 };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.reload();
    await proto.locator(`.persona[data-u="${screen.persona}"]`).click();
    await proto.locator("#app").waitFor();
    if (screen.proto) await proto.evaluate(screen.proto);
    if (screen.scroll) await scrollMain(proto, screen.scroll);
    await settle(proto);
    const protoPng = await proto.screenshot();

    const app = await context.newPage();
    await mockApiAs(app, USER_ID[screen.persona], {
      extra: { ...CORRECTION_DATASETS, ...screen.extra },
      onWrite: screen.onWrite,
    });
    await app.goto(screen.path);
    await app.locator("main h1").first().waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    if (screen.app) await screen.app(app);
    await app.waitForTimeout(300);
    if (screen.scroll) await scrollMain(app, screen.scroll);
    await settle(app);
    const appPng = await app.screenshot();

    const base = `screen-${screen.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% differing pixels`);
    await context.close();
  });
}
