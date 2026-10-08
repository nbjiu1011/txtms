/**
 * Side-by-side capture of the M5 / M6 / M7 screens and modals: the prototype (persona login + its own
 * actions) next to this app against a running API in demo mode (same persona).
 *   node e2e/real/admin-visual.mjs [name…]    (BASE=http://localhost:4246, VISUAL_SIZES=1440x900,1180x800,860x900)
 * Writes `visual-{name}.prototype.png`, `.app.png` and `.side-by-side.png` (prototype | app | diff) to
 * e2e/real/out and prints the share of differing pixels. Data differs on purpose (prototype seed vs
 * the dev DB), so the numbers are a guide; read the images.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { BASE, OUT } from "./helpers.mjs";

const PROTOTYPE_URL = "file:///E:/workspace/txtms/tx-tms-prototype.html";
const NAMES = { u1: "김서연", u3: "이도현", u5: "정우진", u11: "강민호" };

/** `app` runs in the app page after the path loaded; `proto` is evaluated in the prototype. */
const SCREENS = [
  { name: "performance-u3", persona: "u3", path: "/performance", proto: "A.nav({dataset:{r:'perf'}})" },
  {
    name: "notices-u1",
    persona: "u1",
    path: "/notices",
    app: (p) => p.locator("main [role=tabpanel]:visible").getByRole("button", { name: /추석 연휴/ }).click(),
    proto: "A.nav({dataset:{r:'notices'}});A.noticeOpen({dataset:{id:S.notices.find(n=>n.title.includes('추석')).id}})",
  },
  { name: "projects-u11", persona: "u11", path: "/admin/projects", proto: "A.nav({dataset:{r:'projects'}})" },
  {
    name: "project-modal-u11",
    persona: "u11",
    path: "/admin/projects",
    app: (p) => p.getByRole("button", { name: "프로젝트 추가" }).click(),
    proto: "A.nav({dataset:{r:'projects'}});A.projEdit({dataset:{id:''}})",
  },
  { name: "variables-u11", persona: "u11", path: "/admin/variables", proto: "A.nav({dataset:{r:'vars'}})" },
  {
    name: "variable-modal-u11",
    persona: "u11",
    path: "/admin/variables",
    app: (p) => p.getByRole("button", { name: "변수 등록" }).click(),
    proto: "A.nav({dataset:{r:'vars'}});A.varNew({dataset:{pid:S.pid}})",
  },
  { name: "users-u11", persona: "u11", path: "/admin/users", proto: "A.nav({dataset:{r:'users'}})" },
  {
    name: "invite-modal-u11",
    persona: "u11",
    path: "/admin/users",
    app: async (p) => {
      await p.getByRole("button", { name: "사용자 초대" }).click();
      await p.getByRole("dialog").getByLabel(/이메일/).fill("kim@partner.com");
      await p.getByRole("dialog").getByLabel(/^이름/).fill("협력");
    },
    proto: "A.nav({dataset:{r:'users'}});A.inviteUser();UI.m.email='kim@partner.com';UI.m.name='협력';renderOv()",
  },
  {
    name: "role-modal-u11",
    persona: "u11",
    path: "/admin/users",
    app: (p) =>
      p.locator("main [role=tabpanel]:visible").getByRole("row").filter({ hasText: "dohyun.lee" }).getByRole("button", { name: "역할" }).click(),
    proto: "A.nav({dataset:{r:'users'}});A.roleEdit({dataset:{id:'u3'}})",
  },
  { name: "customer-u11", persona: "u11", path: "/admin/customer", proto: "A.nav({dataset:{r:'customer'}})" },
  { name: "notice-admin-u11", persona: "u11", path: "/admin/notices", proto: "A.nav({dataset:{r:'noticeAdmin'}})" },
  {
    name: "notice-modal-u11",
    persona: "u11",
    path: "/admin/notices",
    app: (p) => p.getByRole("button", { name: "공지 작성" }).click(),
    proto: "A.nav({dataset:{r:'noticeAdmin'}});A.noticeEdit({dataset:{id:''}})",
  },
  // M7 solution operator (정우진)
  { name: "ops-home-u5", persona: "u5", path: "/", proto: "" },
  { name: "ops-customers-u5", persona: "u5", path: "/ops/customers", proto: "A.nav({dataset:{r:'opsCust'}})" },
  { name: "ops-setup-u5", persona: "u5", path: "/ops/setup", proto: "A.nav({dataset:{r:'opsSeed'}})" },
  { name: "ops-assign-u5", persona: "u5", path: "/ops/standards", proto: "A.nav({dataset:{r:'standards'}})" },
  {
    name: "ops-types-u5",
    persona: "u5",
    path: "/ops/standards",
    app: (p) => p.getByRole("tab", { name: "유형 관리" }).click(),
    proto: "A.nav({dataset:{r:'standards'}});A.sub({dataset:{k:'types'}})",
  },
  {
    name: "ops-datasets-u5",
    persona: "u5",
    path: "/ops/standards",
    app: (p) => p.getByRole("tab", { name: "데이터셋 시드" }).click(),
    proto: "A.nav({dataset:{r:'standards'}});A.sub({dataset:{k:'ds'}})",
  },
  {
    name: "ops-create-modal-u5",
    persona: "u5",
    path: "/",
    app: (p) => p.getByRole("button", { name: "고객사 생성" }).click(),
    proto: "A.opsCustNew()",
  },
  {
    name: "ops-deactivate-modal-u5",
    persona: "u5",
    path: "/ops/customers",
    app: (p) =>
      p.locator("main [role=tabpanel]:visible").getByRole("row", { name: /^도담생명/ }).getByRole("button", { name: "비활성" }).click(),
    proto: "A.nav({dataset:{r:'opsCust'}});A.opsCustDeact({dataset:{id:'c2'}})",
  },
  {
    name: "ops-project-modal-u5",
    persona: "u5",
    path: "/ops/setup",
    app: (p) => p.getByRole("button", { name: "프로젝트 생성" }).click(),
    proto: "A.nav({dataset:{r:'opsSeed'}});A.seedProject({dataset:{cid:'c1'}})",
  },
  {
    name: "ops-admin-invite-u5",
    persona: "u5",
    path: "/ops/setup",
    app: (p) => p.getByRole("button", { name: "관리자 초대" }).click(),
    proto: "A.nav({dataset:{r:'opsSeed'}});A.seedUser({dataset:{cid:'c1',role:'admin'}})",
  },
  {
    name: "ops-sample-modal-u5",
    persona: "u5",
    path: "/ops/setup",
    app: (p) => p.getByRole("button", { name: "샘플 요청 생성" }).click(),
    proto: "A.nav({dataset:{r:'opsSeed'}});A.seedSample({dataset:{cid:'c1'}})",
  },
  {
    name: "ops-dataset-modal-u5",
    persona: "u5",
    path: "/ops/standards",
    app: async (p) => {
      await p.getByRole("tab", { name: "데이터셋 시드" }).click();
      await p.getByRole("button", { name: "데이터셋 등록" }).click();
    },
    proto: "A.nav({dataset:{r:'standards'}});A.sub({dataset:{k:'ds'}});A.datasetSeed()",
  },
];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function compose(page, a, b) {
  const toUrl = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
  await page.goto("about:blank");
  const result = await page.evaluate(
    async ({ a, b }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const canvas = () => Object.assign(document.createElement("canvas"), { width: w, height: h });
      const ca = canvas();
      const cb = canvas();
      const xa = ca.getContext("2d");
      const xb = cb.getContext("2d");
      xa.drawImage(ia, 0, 0);
      xb.drawImage(ib, 0, 0);
      const da = xa.getImageData(0, 0, w, h);
      const db = xb.getImageData(0, 0, w, h);
      const diff = new ImageData(w, h);
      let bad = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = [0, 1, 2].some((k) => Math.abs(da.data[i + k] - db.data[i + k]) > 24);
        if (d) bad++;
        const g = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3;
        diff.data[i] = d ? 255 : g * 0.3 + 170;
        diff.data[i + 1] = d ? 0 : g * 0.3 + 170;
        diff.data[i + 2] = d ? 0 : g * 0.3 + 170;
        diff.data[i + 3] = 255;
      }
      const out = Object.assign(document.createElement("canvas"), { width: w * 3 + 32, height: h });
      const xo = out.getContext("2d");
      xo.fillStyle = "#333";
      xo.fillRect(0, 0, out.width, out.height);
      xo.drawImage(ca, 0, 0);
      xo.drawImage(cb, w + 16, 0);
      xo.putImageData(diff, (w + 16) * 2, 0);
      return { dataUrl: out.toDataURL("image/png"), mismatch: bad / (w * h) };
    },
    { a: toUrl(a), b: toUrl(b) },
  );
  return { image: Buffer.from(result.dataUrl.split(",")[1], "base64"), mismatch: result.mismatch };
}

/** `VISUAL_SIZES` (default 1440x900); other sizes get a `-{w}x{h}` file suffix. */
const SIZES = (process.env.VISUAL_SIZES ?? "1440x900").split(",").map((name) => {
  const [width, height] = name.trim().split("x").map(Number);
  return { name: name.trim(), width, height, suffix: name.trim() === "1440x900" ? "" : `-${name.trim()}` };
});

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const browser = await chromium.launch();
for (const size of SIZES)
for (const screen of SCREENS.filter((s) => !only.length || only.includes(s.name))) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul" });

  const proto = await context.newPage();
  await proto.goto(PROTOTYPE_URL);
  await proto.evaluate(() => localStorage.clear());
  await proto.reload();
  await proto.locator(`.persona[data-u="${screen.persona}"]`).click();
  await proto.locator("#app").waitFor();
  await proto.evaluate(screen.proto);
  await proto.mouse.move(0, size.height - 1);
  await settle(proto);
  const protoPng = await proto.screenshot();

  const app = await context.newPage();
  await app.goto(`${BASE}/login`);
  await app.getByRole("button", { name: new RegExp(NAMES[screen.persona]) }).click();
  await app.waitForURL((u) => !u.pathname.startsWith("/login"));
  await app.goto(`${BASE}${screen.path}`);
  await app.locator("main h1:visible").first().waitFor({ timeout: 30_000 });
  await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await app.waitForTimeout(800);
  if (screen.app) await screen.app(app);
  await app.mouse.move(0, size.height - 1);
  await app.waitForTimeout(400);
  await settle(app);
  const appPng = await app.screenshot();

  const base = join(OUT, `visual-${screen.name}${size.suffix}`);
  writeFileSync(`${base}.prototype.png`, protoPng);
  writeFileSync(`${base}.app.png`, appPng);
  const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
  writeFileSync(`${base}.side-by-side.png`, image);
  console.log(`visual-${screen.name}${size.suffix}: ${(mismatch * 100).toFixed(2)}% differing pixels`);
  await context.close();
}
await browser.close();
