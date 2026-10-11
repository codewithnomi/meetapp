// Unit tests for the desktop app's own code (security rules, file serving, settings). The real
// window is tested end to end by tests/e2e/desktop (Playwright + Electron).
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "desktop", environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
