// Tests for the contrast check (F00 T10, AC-F00-11): every required color pair (design.md section 7)
// meets WCAG 2.2 AA in all 8 accents × 2 themes, and a failure names the pair, theme, accent and ratio.
import { describe, expect, it } from "vitest";
import { contrastRatio, findContrastFailures, requiredPairs, type ContrastPair } from "./contrast.ts";
import { ACCENTS, THEMES, loadTokens, resolveColor, type DesignTokens, type Theme } from "./tokens.ts";

const SURFACES = ["bg", "surface", "surface-raised", "surface-sunken"];

/** A copy of the tokens with one color changed in one theme (tokens.json itself is never touched). */
function withColor(tokens: DesignTokens, name: string, theme: Theme, value: string): DesignTokens {
  const copy = structuredClone(tokens);
  const token = copy.color.tokens.find((candidate) => candidate.name === name);
  if (!token) throw new Error(`No color token "${name}" in tokens.json`);
  token.value[theme] = value;
  return copy;
}

function hasPair(pairs: ContrastPair[], foreground: string, background: string, minimum: number): boolean {
  return pairs.some(
    (pair) => pair.foreground === foreground && pair.background === background && pair.minimum === minimum,
  );
}

describe("TC-F00-22 [AC-F00-11] contrast matrix passes for every accent and theme", () => {
  it("TC-F00-22 [AC-F00-11] the approved tokens.json has no contrast failures", () => {
    // Messages (not objects) so a failure prints the pair, theme, accent and ratio.
    expect(findContrastFailures(loadTokens()).map((failure) => failure.message)).toEqual([]);
  });

  it("TC-F00-22 [AC-F00-11] proposed fix: dark line-strong #637282 makes the matrix pass", () => {
    const fixed = withColor(loadTokens(), "line-strong", "dark", "#637282");
    expect(findContrastFailures(fixed).map((failure) => failure.message)).toEqual([]);
  });

  it("TC-F00-22 [AC-F00-11] the pair list covers every pair in design section 7 (41 pairs)", () => {
    const pairs = requiredPairs();
    expect(pairs).toHaveLength(41);
    expect(hasPair(pairs, "on-accent", "accent", 4.5)).toBe(true);
    for (const surface of ["bg", "surface", "surface-sunken", "accent-soft"]) {
      expect(hasPair(pairs, "accent-text", surface, 4.5), `accent-text on ${surface}`).toBe(true);
    }
    for (const surface of SURFACES) {
      for (const ink of ["ink", "ink-muted", "ink-subtle"]) {
        expect(hasPair(pairs, ink, surface, 4.5), `${ink} on ${surface}`).toBe(true);
      }
      for (const line of ["focus-ring", "line-strong"]) {
        expect(hasPair(pairs, line, surface, 3), `${line} on ${surface}`).toBe(true);
      }
    }
    for (const status of ["success", "warning", "danger"]) {
      for (const surface of [...SURFACES, `${status}-soft`]) {
        expect(hasPair(pairs, status, surface, 4.5), `${status} on ${surface}`).toBe(true);
      }
    }
    expect(hasPair(pairs, "on-danger-fill", "danger-fill", 4.5)).toBe(true);
  });

  it("TC-F00-22 [AC-F00-11] only focus-ring and line-strong use the 3:1 outline minimum", () => {
    const outlines = requiredPairs().filter((pair) => pair.minimum === 3);
    expect([...new Set(outlines.map((pair) => pair.foreground))].sort()).toEqual(["focus-ring", "line-strong"]);
    expect(requiredPairs().every((pair) => pair.minimum === 3 || pair.minimum === 4.5)).toBe(true);
  });

  it("TC-F00-22 [AC-F00-11] the matrix runs over 8 accents and 2 themes", () => {
    expect([...ACCENTS]).toEqual(["sky", "blue", "purple", "pink", "red", "orange", "green", "teal"]);
    expect(THEMES).toEqual(["light", "dark"]);
  });

  // Breaking on-accent-<accent> in one theme must be caught for exactly that accent and theme,
  // which proves every one of the 16 combinations is really checked.
  it.each(THEMES.flatMap((theme) => ACCENTS.map((accent) => [theme, accent] as const)))(
    "TC-F00-22 [AC-F00-11] a bad on-accent color is caught in %s mode with the %s accent",
    (theme, accent) => {
      const tokens = loadTokens();
      const fill = resolveColor(tokens, `accent-${accent}`, theme);
      const broken = withColor(tokens, `on-accent-${accent}`, theme, fill);
      const caught = findContrastFailures(broken).filter(
        (failure) => failure.foreground === "on-accent" && failure.background === "accent",
      );
      expect(caught.map((failure) => [failure.theme, failure.accent])).toEqual([[theme, accent]]);
    },
  );

  it("TC-F00-22 [AC-F00-11] accent aliases follow the chosen accent when resolved", () => {
    const tokens = loadTokens();
    for (const theme of THEMES) {
      for (const accent of ACCENTS) {
        const ownText = resolveColor(tokens, `accent-${accent}-text`, theme);
        expect(resolveColor(tokens, "accent-text", theme, accent)).toBe(ownText);
        expect(resolveColor(tokens, "focus-ring", theme, accent)).toBe(ownText);
        expect(resolveColor(tokens, "accent", theme, accent)).toBe(resolveColor(tokens, `accent-${accent}`, theme));
      }
    }
  });
});

describe("TC-F00-22 [AC-F00-11] contrastRatio follows the WCAG formula", () => {
  it("TC-F00-22 [AC-F00-11] black on white is 21:1, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
  });

  it("TC-F00-22 [AC-F00-11] a color on itself is 1:1", () => {
    expect(contrastRatio("#5d6b7b", "#5d6b7b")).toBe(1);
  });

  it("TC-F00-22 [AC-F00-11] a value that is not #rrggbb is refused, not guessed", () => {
    expect(() => contrastRatio("rgba(5, 9, 14, 0.62)", "#ffffff")).toThrow(/#rrggbb/);
  });
});

describe("TC-F00-23 [AC-F00-11] contrast check names the failing color and mode", () => {
  // Grey #575757 on the dark teal fill #2dd4bf is about 3.88:1, below the 4.5:1 text minimum.
  const FIXTURE_ON_ACCENT = "#575757";

  it("TC-F00-23 [AC-F00-11] the fixture color lands at about 3.9:1", () => {
    const ratio = contrastRatio(FIXTURE_ON_ACCENT, resolveColor(loadTokens(), "accent-teal", "dark"));
    expect(ratio).toBeGreaterThanOrEqual(3.85);
    expect(ratio).toBeLessThanOrEqual(3.95);
  });

  it("TC-F00-23 [AC-F00-11] dark teal on-accent at 3.9:1 fails naming pair, dark, teal and ratio", () => {
    const tokens = withColor(loadTokens(), "on-accent-teal", "dark", FIXTURE_ON_ACCENT);
    const ratio = contrastRatio(FIXTURE_ON_ACCENT, resolveColor(tokens, "accent-teal", "dark")).toFixed(2);
    const failure = findContrastFailures(tokens).find(
      (candidate) => candidate.foreground === "on-accent" && candidate.background === "accent",
    );
    expect(failure).toMatchObject({ theme: "dark", accent: "teal", minimum: 4.5 });
    expect(ratio).toBe("3.88");
    expect(failure?.message).toBe(`on-accent on accent is ${ratio}:1 in dark mode with the teal accent (needs 4.5:1)`);
  });

  it("TC-F00-23 [AC-F00-11] the same color is not reported for light mode or other accents", () => {
    const tokens = withColor(loadTokens(), "on-accent-teal", "dark", FIXTURE_ON_ACCENT);
    const onAccent = findContrastFailures(tokens).filter((failure) => failure.foreground === "on-accent");
    expect(onAccent.map((failure) => `${failure.theme}/${failure.accent}`)).toEqual(["dark/teal"]);
  });
});
