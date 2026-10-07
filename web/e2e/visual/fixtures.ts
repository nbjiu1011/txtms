import type { Page } from "@playwright/test";

/** Reference prototype (visual source of truth). */
export const PROTOTYPE_URL = "file:///E:/workspace/txtms/tx-tms-prototype.html";

export const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "820x1000", width: 820, height: 1000 },
] as const;

/**
 * Demo personas as the API returns them in demo mode (same people/order as the reference
 * login screen) — test fixture only, used to render the persona list without a running API.
 */
export const DEMO_PERSONAS = [
  { userId: 1, name: "김서연", roleLabel: "요청자", description: "한빛카드, 카드 혜택 알림", avatarColor: "#3C6E71" },
  { userId: 2, name: "박지훈", roleLabel: "검수자 (회수 처리 주담당)", description: "한빛카드", avatarColor: "#8C5E3C" },
  { userId: 3, name: "이도현", roleLabel: "검수자 + 대표 검수자", description: "한빛카드, 배정과 실적", avatarColor: "#4B5D9A" },
  { userId: 6, name: "한가을", roleLabel: "검수자 (편집 잠금 보유)", description: "한빛카드", avatarColor: "#A0473F" },
  { userId: 4, name: "최민아", roleLabel: "승인자", description: "한빛카드, 승인 단계 사용", avatarColor: "#7A4A8C" },
  { userId: 11, name: "강민호", roleLabel: "고객사 관리자", description: "한빛카드, 프로젝트·사용자·공지", avatarColor: "#45606B" },
  { userId: 5, name: "정우진", roleLabel: "솔루션 운영 담당자", description: "고객사 등록, 초기 설정, 교정 기준", avatarColor: "#2F3B52" },
  { userId: 9, name: "문지아", roleLabel: "요청자", description: "도담생명, 승인 단계 미사용", avatarColor: "#9A6B2F" },
  { userId: 8, name: "윤태오", roleLabel: "검수자 + 대표 검수자", description: "도담생명", avatarColor: "#3A6E8F" },
];

/** Mocks the auth endpoints the login page calls (anonymous visitor, demo mode on). */
export async function mockAnonymousDemoApi(page: Page): Promise<void> {
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNAUTHENTICATED", message: "로그인이 필요합니다" }),
    }),
  );
  await page.route("**/api/auth/demo-personas", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEMO_PERSONAS) }),
  );
}

/** Waits for web fonts and two animation frames so the screenshot is stable. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

/**
 * Builds a side-by-side image (prototype | app | diff) in the browser and returns it with the
 * share of differing pixels (per-channel tolerance 24).
 */
export async function compose(
  page: Page,
  prototypePng: Buffer,
  appPng: Buffer,
): Promise<{ image: Buffer; mismatch: number }> {
  const toUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("about:blank");
  const result = await page.evaluate(
    async ({ a, b }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ca = document.createElement("canvas");
      const cb = document.createElement("canvas");
      for (const c of [ca, cb]) {
        c.width = w;
        c.height = h;
      }
      const xa = ca.getContext("2d")!;
      const xb = cb.getContext("2d")!;
      xa.fillStyle = "#ff00ff";
      xa.fillRect(0, 0, w, h);
      xb.fillStyle = "#ff00ff";
      xb.fillRect(0, 0, w, h);
      xa.drawImage(ia, 0, 0);
      xb.drawImage(ib, 0, 0);
      const da = xa.getImageData(0, 0, w, h);
      const db = xb.getImageData(0, 0, w, h);
      const diff = new ImageData(w, h);
      let bad = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d =
          Math.abs(da.data[i] - db.data[i]) > 24 ||
          Math.abs(da.data[i + 1] - db.data[i + 1]) > 24 ||
          Math.abs(da.data[i + 2] - db.data[i + 2]) > 24;
        if (d) bad++;
        const g = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3;
        diff.data[i] = d ? 255 : g * 0.3 + 170;
        diff.data[i + 1] = d ? 0 : g * 0.3 + 170;
        diff.data[i + 2] = d ? 0 : g * 0.3 + 170;
        diff.data[i + 3] = 255;
      }
      const gap = 16;
      const out = document.createElement("canvas");
      out.width = w * 3 + gap * 2;
      out.height = h;
      const xo = out.getContext("2d")!;
      xo.fillStyle = "#333";
      xo.fillRect(0, 0, out.width, out.height);
      xo.drawImage(ca, 0, 0);
      xo.drawImage(cb, w + gap, 0);
      xo.putImageData(diff, (w + gap) * 2, 0);
      return { dataUrl: out.toDataURL("image/png"), mismatch: bad / (w * h) };
    },
    { a: toUrl(prototypePng), b: toUrl(appPng) },
  );
  return { image: Buffer.from(result.dataUrl.split(",")[1], "base64"), mismatch: result.mismatch };
}
