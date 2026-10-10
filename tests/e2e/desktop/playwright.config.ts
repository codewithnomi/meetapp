// End-to-end tests of the real desktop window (Playwright + Electron): AC-F00-03, 08, 09, 10, 13b, 24, 34.
// Run with `pnpm test:e2e` (it builds the screens and the desktop app first).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  // Each test opens real windows; one at a time keeps them from fighting over focus.
  workers: 1,
  timeout: 30_000,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { trace: "retain-on-failure" },
});
