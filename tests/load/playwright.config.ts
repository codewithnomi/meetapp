// The load tests (F02 T18): run with `pnpm test:load` (tools/load.ts), which starts the test call server
// and the backend, builds the app, and stops everything afterwards.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  globalSetup: "../e2e/desktop/global-setup.ts",
  globalTeardown: "../e2e/desktop/global-teardown.ts",
  outputDir: "test-results/playwright",
  workers: 1,
  timeout: 20 * 60_000,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
});
