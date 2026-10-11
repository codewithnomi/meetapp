// Visual and accessibility run over the built Storybook (AC-F00-13, 14, 33; design.md section 8).
// Run it with `pnpm test:visual` (inside the pinned Playwright image, so screenshots match CI).
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env["GALLERY_PORT"] ?? 6007);

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  // A missing baseline is a failure, never silently created; `pnpm test:visual:update` makes them.
  updateSnapshots: "none",
  // One baseline per story and theme, shared by every test that looks at that story.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 0 },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  projects: [{ name: "light" }, { name: "dark", testIgnore: "checks.spec.ts" }],
  webServer: {
    command: "node serve-storybook.ts",
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${PORT}/index.json`,
    env: { GALLERY_PORT: String(PORT) },
    reuseExistingServer: false,
  },
});
