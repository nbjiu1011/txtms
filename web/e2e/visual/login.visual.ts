import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { PROTOTYPE_URL, VIEWPORTS, compose, mockAnonymousDemoApi, settle } from "./fixtures";

const OUT = join(__dirname, "out");
const APP_DISCLAIMER = "체험 계정은 시연용입니다. 초대 계정은 비밀번호 설정 후 로그인할 수 있습니다.";
const REFERENCE_DISCLAIMER =
  "체험 계정은 시연용입니다. 초대 계정은 비밀번호 설정 후 로그인할 수 있습니다. 인증·메일·저장은 이 브라우저에서 시연합니다.";

/**
 * Login screen: prototype (not logged in → login screen) vs `/login`.
 * Intentional difference: the demo disclaimer sentence below the persona list.
 */
for (const viewport of VIEWPORTS) {
  test(`login ${viewport.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.reload();
    await proto.locator(".login").waitFor();
    await settle(proto);
    const protoPng = await proto.screenshot({ fullPage: true });

    const app = await context.newPage();
    await mockAnonymousDemoApi(app);
    await app.goto("/login");
    await app.getByRole("button", { name: /김서연/ }).waitFor();
    // Hide the Next.js dev indicator (not part of the page).
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await settle(app);
    const appPng = await app.screenshot({ fullPage: true });

    const base = `login-${viewport.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% pixels differ`);

    // Parity check: put the reference disclaimer back; everything else must match.
    await app.getByText(APP_DISCLAIMER).evaluate((el, text) => (el.textContent = text), REFERENCE_DISCLAIMER);
    await settle(app);
    const parityPng = await app.screenshot({ fullPage: true });
    const parity = await compose(await context.newPage(), protoPng, parityPng);
    writeFileSync(join(OUT, `${base}.parity.png`), parity.image);
    console.log(`${base} (reference disclaimer restored): ${(parity.mismatch * 100).toFixed(2)}% pixels differ`);
    await context.close();
  });
}
