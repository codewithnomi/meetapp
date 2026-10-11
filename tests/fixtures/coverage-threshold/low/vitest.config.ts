// Fixture project using the shared coverage rule (TC-F00-40), with src/logic as its business logic.
import { coverageSettings } from "@meetapp/config/vitest/coverage";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: { ...coverageSettings(["src/logic/**"]), reporter: ["text-summary"] },
  },
});
