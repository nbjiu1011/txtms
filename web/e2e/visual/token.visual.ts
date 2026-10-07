import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { PROTOTYPE_URL, VIEWPORTS, compose, settle } from "./fixtures";

const OUT = join(__dirname, "out");

/** Invitation page with an invalid/expired link: prototype `#/invite/{token}` vs `/invite/{token}`. */
for (const viewport of VIEWPORTS) {
  test(`invite invalid ${viewport.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.goto(`${PROTOTYPE_URL}#/invite/expired-token`);
    await proto.reload();
    await proto.locator(".login-l h1").waitFor();
    await settle(proto);
    const protoPng = await proto.screenshot({ fullPage: true });

    const app = await context.newPage();
    await app.route("**/api/auth/refresh", (r) =>
      r.fulfill({ status: 401, contentType: "application/json", body: '{"code":"UNAUTHENTICATED","message":"x"}' }),
    );
    await app.route("**/api/auth/tokens/expired-token", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"kind":"INVITATION","valid":false}' }),
    );
    await app.goto("/invite/expired-token");
    await app.getByText("유효하지 않거나 만료된 링크입니다", { exact: false }).waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await settle(app);
    const appPng = await app.screenshot({ fullPage: true });

    const base = `invite-invalid-${viewport.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image, mismatch } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);
    console.log(`${base}: ${(mismatch * 100).toFixed(2)}% pixels differ`);
    await context.close();
  });
}
