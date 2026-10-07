import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { history105, request105U1, variablesP1 } from "../fixtures/draft-snapshot";
import { mockApiAs, type MockWrite } from "../fixtures/mock-api";
import { PROTOTYPE_URL, compose, settle } from "./fixtures";

const OUT = join(__dirname, "out");

/** Fills the draft so the prototype's submit validation passes (to reach the confirmation modal). */
const FILL_PROTO = `(() => { const r = S.requests.find(x => x.id === 'REQ-2609-105'); r.target = '카드 보유 고객'; r.bg = '연말 이벤트';
  r.contents[0].f.tpl = 'HB_POINT_01'; })();`;
const filledDetail = {
  ...request105U1,
  target: "카드 보유 고객",
  background: "연말 이벤트",
  contents: request105U1.contents.map((c) => ({ ...c, payload: { ...c.payload, templateCode: "HB_POINT_01" } })),
};

interface DraftScreen {
  name: string;
  /** Prototype script after persona login. */
  proto: string;
  /** App interaction after load. */
  app?: (page: Page) => Promise<void>;
  /** Capture only the modal dialog. */
  modal?: boolean;
  detail?: typeof request105U1;
  onWrite?: (write: MockWrite) => { status: number; body?: unknown } | undefined;
  /** Read the prototype's modal list items before the app run (to answer the submit mock). */
  readProtoList?: boolean;
  /** Scroll of `main` in both. */
  scroll?: number;
}

async function scrollMain(page: Page, top: number) {
  await page.evaluate((y) => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = y;
  }, top);
}

const openReq = "A.openReq({dataset:{id:'REQ-2609-105'}});";
let protoMissing: string[] = [];

const SCREENS: DraftScreen[] = [
  { name: "draft-105-u1", proto: openReq },
  {
    name: "draft-105-u1-info",
    proto: `${openReq}A.sub({dataset:{k:'info'}});`,
    app: (p) => p.getByRole("tab", { name: "요청 정보" }).click(),
  },
  {
    name: "draft-105-u1-preview",
    proto: `${openReq}A.spTab({dataset:{k:'mock'}});`,
    app: (p) => p.getByRole("tab", { name: "미리보기" }).click(),
  },
  {
    name: "draft-105-u1-submit-missing",
    proto: `${openReq}A.submit();`,
    readProtoList: true,
    modal: true,
    app: async (p) => {
      await p.getByRole("button", { name: "검수 요청" }).click();
      await p.getByRole("dialog", { name: "검수를 요청할까요?" }).getByRole("button", { name: "검수 요청" }).click();
      await p.getByRole("dialog", { name: "검수를 요청하려면 다음 항목을 채우세요" }).waitFor();
    },
    onWrite: (w) =>
      w.path.endsWith("/submit")
        ? {
            status: 400,
            body: {
              code: "VALIDATION_FAILED",
              message: "검수를 요청하려면 다음 항목을 채우세요",
              details: protoMissing,
              fieldErrors: [
                { field: "target", message: "대상 고객을(를) 입력하세요" },
                { field: "background", message: "배경을(를) 입력하세요" },
              ],
            },
          }
        : undefined,
  },
  {
    name: "draft-105-u1-submit-confirm",
    proto: `${FILL_PROTO}${openReq}A.submit();`,
    modal: true,
    detail: filledDetail,
    app: async (p) => {
      await p.getByRole("button", { name: "검수 요청" }).click();
      await p.getByRole("dialog", { name: "검수를 요청할까요?" }).waitFor();
    },
  },
];

/**
 * Draft editing screens (REQ-2609-105 as 김서연) next to the prototype. Intended differences: today's
 * date, the prototype-only "첨부 검사 시연" panel and "기능 대응표", the note in the submit
 * confirmation (correction is optional), and server-validated submit (the app asks for confirmation
 * first and shows the missing list from the server answer).
 */
for (const screen of SCREENS) {
  test(`draft ${screen.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.reload();
    await proto.locator('.persona[data-u="u1"]').click();
    await proto.locator("#app").waitFor();
    await proto.evaluate(screen.proto);
    if (screen.scroll) await scrollMain(proto, screen.scroll);
    if (screen.readProtoList) protoMissing = await proto.locator(".modal-b li").allTextContents();
    await settle(proto);
    const protoPng = screen.modal ? await proto.locator(".modal").screenshot() : await proto.screenshot();

    const app = await context.newPage();
    await mockApiAs(app, 1, {
      extra: {
        "/requests/REQ-2609-105": screen.detail ?? request105U1,
        "/requests/REQ-2609-105/history": history105,
        "/projects/1/variables": variablesP1,
      },
      onWrite: screen.onWrite,
    });
    await app.goto("/requests/REQ-2609-105");
    await app.locator("main h1").first().waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    if (screen.app) await screen.app(app);
    await app.waitForTimeout(300);
    if (screen.scroll) await scrollMain(app, screen.scroll);
    await settle(app);
    const appPng = screen.modal ? await app.getByRole("dialog").last().screenshot() : await app.screenshot();

    const base = `screen-${screen.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% differing pixels`);
    await context.close();
  });
}
