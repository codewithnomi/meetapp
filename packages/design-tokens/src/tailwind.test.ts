// TC-F00-37 palette-reset part (AC-F00-15), carried over from T2: compiling the generated theme with
// the real Tailwind v4 compiler gives token classes only. Palette classes such as bg-blue-500 produce
// no CSS at all, and token classes point at the variables from tokens.css (so themes switch at runtime).
import { compile } from "@tailwindcss/node";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { generateTheme } from "./generate-theme.ts";
import { loadTokens } from "./tokens.ts";

// Imports such as "tailwindcss/theme.css" resolve from this package, where tailwindcss is installed.
const BASE = fileURLToPath(new URL("..", import.meta.url));
const PALETTE_CLASSES = ["bg-blue-500", "text-white", "border-red-300"];
const TOKEN_CLASSES = ["bg-surface", "text-ink", "rounded-full", "shadow-2", "text-label", "p-4"];

let output = "";

/** Body of the rule for `.className`, or undefined when Tailwind generated nothing for it. */
function rule(className: string): string | undefined {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`).exec(output)?.[1];
}

beforeAll(async () => {
  const css = [
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
    generateTheme(loadTokens()),
  ].join("\n");
  const compiler = await compile(css, { base: BASE, onDependency: () => undefined });
  output = compiler.build([...PALETTE_CLASSES, ...TOKEN_CLASSES]);
});

describe("TC-F00-37 [AC-F00-15] a build using bg-blue-500 produces no blue CSS rule (palette reset)", () => {
  it.each(PALETTE_CLASSES)("TC-F00-37 [AC-F00-15] %s produces no CSS rule", (className) => {
    expect(rule(className)).toBeUndefined();
  });

  it("TC-F00-37 [AC-F00-15] none of Tailwind's palette colors are defined", () => {
    expect(output).not.toMatch(/--color-(?:blue|red|white|black|slate|gray)\b/);
  });

  it("TC-F00-37 [AC-F00-15] token classes point at the token variables", () => {
    expect(rule("bg-surface")).toContain("background-color: var(--surface)");
    expect(rule("text-ink")).toContain("color: var(--ink)");
    expect(rule("rounded-full")).toContain("border-radius: var(--radius-full)");
    expect(rule("shadow-2")).toContain("var(--shadow-2)");
  });

  it("TC-F00-37 [AC-F00-15] text-label uses the label text style from tokens.json", () => {
    const label = loadTokens()
      .type.groups.flatMap((group) => group.styles)
      .find((style) => style.name === "label");
    expect(rule("text-label")).toContain(`font-size: ${label?.fontSize ?? "missing"}`);
    expect(rule("text-label")).toContain(label?.lineHeight ?? "missing");
    expect(rule("text-label")).toContain(String(label?.fontWeight ?? "missing"));
  });

  it("TC-F00-37 [AC-F00-15] p-4 is 4 spacing steps, and one step is space-1", () => {
    expect(rule("p-4")).toContain("padding: calc(var(--spacing) * 4)");
    expect(output).toMatch(/--spacing:\s*4px;/);
  });

  it.each(["surface", "ink", "radius-full", "shadow-2"])(
    "TC-F00-37 [AC-F00-15] the build never defines --%s itself (no self-referencing variable)",
    (name) => {
      expect(output).not.toMatch(new RegExp(`(?<![\\w-])--${name}\\s*:`));
    },
  );
});
