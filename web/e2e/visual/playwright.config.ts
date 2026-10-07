import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.VISUAL_PORT ?? 3100);

/**
 * Visual comparison harness: reference prototype (file://) vs this app, same viewport.
 * Output: e2e/visual/out/*.png (gitignored). Run: `npm run e2e:visual`.
 * The prototype loads its fonts from Google Fonts, so this needs internet access.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.visual\.ts$/,
  outputDir: "./out/test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    cwd: "../..",
    reuseExistingServer: true,
    timeout: 180_000,
    env: { API_ORIGIN: "http://127.0.0.1:9" },
  },
});
