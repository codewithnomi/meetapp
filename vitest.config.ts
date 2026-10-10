import { configDefaults, defineConfig } from "vitest/config";

// Root test runner. Grows into one run with a project per package in T16.
// Integration tests need the local services running; they run with `pnpm test:integration`.
const INTEGRATION_TESTS = ["**/*.integration.test.ts"];
const integration = process.env["VITEST_INTEGRATION"] === "1";

export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts", "infra/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ...(integration ? [] : INTEGRATION_TESTS)],
    // Integration tests stop and restart the shared local services, so their files run one at a time.
    fileParallelism: !integration,
  },
});
