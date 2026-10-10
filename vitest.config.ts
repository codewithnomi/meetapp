import { coverageSettings } from "@meetapp/config/vitest/coverage";
import { configDefaults, defineConfig } from "vitest/config";

// Root test runner: one run over every project. Grows with the apps (T14, T15) and folds integration
// tests into `pnpm test` in T16. Integration tests need the local services; run with `pnpm test:integration`.
const INTEGRATION_TESTS = ["**/*.integration.test.ts"];
const integration = process.env["VITEST_INTEGRATION"] === "1";
// Monitoring checks stop services and wait for alerts (about 20 minutes): only `pnpm test:monitoring` runs them.
const MONITORING_TESTS = ["**/*.monitoring.test.ts"];
const monitoring = process.env["VITEST_MONITORING"] === "1";

export default defineConfig({
  test: {
    // Used with --coverage (pnpm test): one merged report; business logic must be at least 80% covered.
    coverage: coverageSettings(),
    // Integration tests stop and restart the shared local services, so their files run one at a time.
    fileParallelism: !integration && !monitoring,
    projects: [
      {
        test: {
          name: "node",
          include: [
            "tools/**/*.test.ts",
            "infra/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            "apps/*/src/**/*.test.ts",
          ],
          // apps/web tests need a simulated browser; they run in their own project below.
          exclude: [
            ...configDefaults.exclude,
            "apps/web/**",
            "apps/desktop/**",
            ...(integration ? [] : INTEGRATION_TESTS),
            ...(monitoring ? [] : MONITORING_TESTS),
          ],
        },
      },
      "./packages/ui/vitest.config.ts",
      "./apps/web/vitest.config.ts",
      "./apps/desktop/vitest.config.ts",
    ],
  },
});
