import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type Page } from "@playwright/test";
import { DEMO_PERSONAS, PROTOTYPE_URL, compose, settle } from "./fixtures";

const OUT = join(__dirname, "out");

/** Fixture session of persona 김서연 (requester) — mirrors the reference seed. */
const ME = {
  id: 1,
  name: "김서연",
  dept: "카드마케팅팀",
  email: "seoyeon.kim@hanbitcard.co.kr",
  customerId: 1,
  operator: false,
  adminCustomerIds: [],
  avatarColor: "#3C6E71",
  demo: true,
  memberships: [{ projectId: 1, customerId: 1, roles: ["REQUESTER"], lead: false }],
  session: { remember: false, expiresAt: "2026-10-07T05:30:00Z" },
};

async function mockSignedIn(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/auth/refresh", (r) => r.fulfill(json({ accessToken: "fixture", me: ME })));
  await page.route("**/api/auth/demo-personas", (r) => r.fulfill(json(DEMO_PERSONAS)));
  await page.route("**/api/customers", (r) =>
    r.fulfill(
      json([
        {
          id: 1,
          name: "한빛카드",
          domain: "hanbitcard.co.kr",
          approvalEnabled: true,
          active: true,
          sample: true,
          notifyChannel: "IN_APP",
          dueSoonDays: 2,
          createdAt: "2026-09-01T00:00:00Z",
        },
      ]),
    ),
  );
  await page.route("**/api/customers/1/projects", (r) =>
    r.fulfill(
      json([
        {
          id: 1,
          customerId: 1,
          name: "카드 혜택 알림",
          active: true,
          leadUserId: 3,
          templates: [],
          senders: [],
          members: [],
          variablesRevision: 1,
        },
        {
          id: 2,
          customerId: 1,
          name: "약관·공지",
          active: true,
          leadUserId: 3,
          templates: [],
          senders: [],
          members: [],
          variablesRevision: 1,
        },
      ]),
    ),
  );
  await page.route("**/api/notifications", (r) =>
    r.fulfill(
      json({
        unreadCount: 2,
        items: [
          {
            id: 1,
            kind: "ASK",
            requestId: "REQ-2609-102",
            text: "확인 요청이 도착했습니다: 결제일 변경 안내",
            createdAt: "2026-10-06T01:20:00Z",
            read: false,
            renotify: false,
            pending: true,
          },
        ],
      }),
    ),
  );
}

/**
 * App shell smoke capture (sidebar, top bar, work tabs) with a fixture session, next to the
 * reference after persona login. Shell menus differ on purpose (unimplemented screens are not
 * listed yet); compare chrome dimensions, colors and typography.
 */
for (const viewport of [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "820x1000", width: 820, height: 1000 },
]) {
  test(`shell ${viewport.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });

    const proto = await context.newPage();
    await proto.goto(PROTOTYPE_URL);
    await proto.evaluate(() => localStorage.clear());
    await proto.reload();
    await proto.locator('.persona[data-u="u1"]').click();
    await proto.locator("#app").waitFor();
    await settle(proto);
    const protoPng = await proto.screenshot();

    const app = await context.newPage();
    await mockSignedIn(app);
    await app.goto("/requests");
    await app.getByRole("tab", { name: "요청" }).waitFor();
    await app.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await settle(app);
    const appPng = await app.screenshot();

    const base = `shell-${viewport.name}`;
    writeFileSync(join(OUT, `${base}.prototype.png`), protoPng);
    writeFileSync(join(OUT, `${base}.app.png`), appPng);
    const { image } = await compose(await context.newPage(), protoPng, appPng);
    writeFileSync(join(OUT, `${base}.side-by-side.png`), image);

    // Popovers and tab interactions.
    await app.getByRole("button", { name: /알림/ }).click();
    await app.getByRole("dialog", { name: "알림" }).waitFor();
    writeFileSync(join(OUT, `${base}.app-notifications.png`), await app.screenshot());
    await app.keyboard.press("Escape");
    await app.getByRole("button", { name: /김서연/ }).click();
    await app.getByRole("dialog", { name: "체험 계정 바꾸기" }).waitFor();
    writeFileSync(join(OUT, `${base}.app-user.png`), await app.screenshot());
    await app.keyboard.press("Escape");
    await app.getByRole("button", { name: "새 탭 열기" }).click();
    await app.getByRole("dialog", { name: "새 탭으로 열기" }).getByRole("button", { name: "대시보드" }).click();
    await app.getByRole("tab", { name: "대시보드" }).waitFor();
    if (viewport.width <= 860) {
      await app.getByRole("button", { name: "메뉴" }).click();
      await app.waitForTimeout(300);
    }
    await settle(app);
    writeFileSync(join(OUT, `${base}.app-two-tabs.png`), await app.screenshot());
    await context.close();
  });
}
