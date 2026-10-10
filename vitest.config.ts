import { configDefaults, defineConfig } from "vitest/config";

// Root test runner. Grows into one run with a project per package in T16.
// Integration tests need the local services running; they run with `pnpm test:integration`.
const INTEGRATION_TESTS = ["**/*.integration.test.ts"];

export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts", "infra/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ...(process.env["VITEST_INTEGRATION"] === "1" ? [] : INTEGRATION_TESTS)],
  },
});
