import { defineConfig } from "vitest/config";

// Root test runner. Grows into one run with a project per package in T16.
export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts"],
  },
});
