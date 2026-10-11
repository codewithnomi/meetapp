// Shared coverage settings (AC-F00-17): business logic must stay at least 80% covered by tests.
// The root vitest.config.ts uses them for `pnpm test`; the test of this rule uses them on a fixture.

/** The folders that hold business logic (design.md section 12). */
export const BUSINESS_LOGIC = [
  "apps/api/src/modules/**",
  "apps/api/src/providers/**",
  "packages/core/**",
  "packages/design-tokens/src/**",
  "apps/web/src/features/**",
];

export const MINIMUM_PERCENT = 80;

/** Coverage options for Vitest: one merged report, and a failure naming each folder group below 80%. */
export function coverageSettings(businessLogic: readonly string[] = BUSINESS_LOGIC) {
  const minimum = {
    lines: MINIMUM_PERCENT,
    functions: MINIMUM_PERCENT,
    branches: MINIMUM_PERCENT,
    statements: MINIMUM_PERCENT,
  };
  return {
    provider: "v8" as const,
    reporter: ["text-summary", "html"],
    reportsDirectory: "coverage",
    include: [...businessLogic],
    // Command-line launchers (cli.ts) only call tested functions; tests and test helpers aren't measured.
    exclude: ["**/*.test.{ts,tsx}", "**/*.integration.test.ts", "**/index.ts", "**/test-support/**", "**/cli.ts"],
    thresholds: Object.fromEntries(businessLogic.map((glob) => [glob, minimum])),
  };
}
