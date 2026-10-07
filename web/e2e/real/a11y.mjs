/**
 * Accessibility check (axe-core, WCAG 2.1 A/AA rules) of the main screens against a running API in demo
 * mode: login, dashboard (김서연), REQ-2609-101 (박지훈), 사용자·권한 관리 (강민호), 고객사 관리 (정우진).
 *   node e2e/real/a11y.mjs            (BASE=http://localhost:3000)
 * Prints the violations per screen and writes `a11y-report.json` to e2e/real/out. Exits 1 when a
 * serious or critical violation is found that is not a known design exception (`KNOWN`); moderate /
 * minor ones are listed only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { BASE, OUT } from "./helpers.mjs";

const SCREENS = [
  { name: "login", persona: null, path: "/login", ready: "로그인" },
  { name: "dashboard-u1", persona: "김서연", path: "/", ready: "김서연님, 오늘 처리할 업무입니다" },
  { name: "request-101-u2", persona: "박지훈", path: "/requests/REQ-2609-101", ready: "10월 포인트 적립 이벤트 알림톡" },
  { name: "admin-users-u11", persona: "강민호", path: "/admin/users", ready: "사용자·권한 관리" },
  { name: "ops-customers-u5", persona: "정우진", path: "/ops/customers", ready: "고객사 관리" },
];
const BLOCKING = new Set(["serious", "critical"]);
/**
 * Known exceptions (listed, not failing): fixing them changes the reference design and needs a design
 * decision — tracked in the improvement backlog.
 */
const KNOWN = {
  "color-contrast": "reference palette: --faint #8c95a4 / chip greys on light surfaces are below 4.5:1 for 12–13px text",
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];
let blocking = 0;
for (const screen of SCREENS) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(`${BASE}/login`);
  if (screen.persona) {
    await page.getByRole("button", { name: new RegExp(screen.persona) }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`${BASE}${screen.path}`);
  }
  await page.getByRole("heading", { name: screen.ready }).first().waitFor();
  await page.waitForTimeout(800);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    // the Next.js dev overlay (development only) is not part of the app
    .exclude("nextjs-portal")
    .analyze();
  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.split("\n").slice(1, 3).join(" ") })),
  }));
  report.push({ screen: screen.name, violations });
  console.log(`${screen.name}: ${violations.length} rule(s) violated`);
  for (const v of violations) {
    const known = KNOWN[v.id];
    if (BLOCKING.has(v.impact ?? "") && !known) blocking++;
    console.log(`  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length})${known ? ` — known: ${known}` : ""}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`      ${n.target}${n.summary ? ` · ${n.summary}` : ""}`);
  }
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, "a11y-report.json"), JSON.stringify(report, null, 2));
if (blocking) {
  console.log(`- FAIL ${blocking} serious/critical rule violation(s)`);
  process.exit(1);
}
console.log("- a11y: no serious or critical violations");
