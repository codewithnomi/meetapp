// Unusual inputs the token tools must handle clearly (AC-F00-11, AC-F00-12): a color that is not
// #rrggbb, a token name that doesn't exist, and a token file without the 4px spacing step.
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import { generateTheme } from "./generate-theme.ts";
import { loadTokens, resolveColor } from "./tokens.ts";

describe("design-token tools with unusual input", () => {
  it("TC-F00-23 [AC-F00-11] contrast refuses a color that is not #rrggbb, naming it", () => {
    expect(() => contrastRatio("#fff", "#000000")).toThrow('Contrast needs a #rrggbb color, got "#fff"');
  });

  it("TC-F00-25 [AC-F00-12] an unknown token name is an error that names it", () => {
    expect(() => resolveColor(loadTokens(), "no-such-token", "light")).toThrow('Unknown color token "no-such-token"');
  });

  it("TC-F00-25 [AC-F00-12] without a space-1 token the theme falls back to the 4px spacing step", () => {
    const tokens = loadTokens();
    const withoutStep = {
      ...tokens,
      spacing: { ...tokens.spacing, tokens: tokens.spacing.tokens.filter((token) => token.name !== "space-1") },
    };
    expect(generateTheme(withoutStep)).toContain("--spacing: 4px");
  });
});
