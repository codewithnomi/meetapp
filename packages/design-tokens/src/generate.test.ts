// TC-F00-25 (AC-F00-12): the generated tokens.css, theme.css and tokens.ts say exactly what tokens.json
// says: every token with the same name and value, nothing invented, nothing missing.
import { describe, expect, it } from "vitest";
import { generateCss } from "./generate.ts";
import { generateTheme, generateTypes } from "./generate-theme.ts";
import { ACCENTS, loadTokens, referenceName, type ThemedToken, type Theme } from "./tokens.ts";

const tokens = loadTokens();
const LIGHT = ':root, [data-theme="light"]';
const DARK = '[data-theme="dark"]';

/** Selector → body of every `selector { body }` block, with comments removed. Blocks must not nest. */
function blocks(css: string): Map<string, string> {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = new Map<string, string>();
  for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? "").trim();
    if (found.has(selector)) throw new Error(`Selector "${selector}" appears twice`);
    found.set(selector, match[2] ?? "");
  }
  return found;
}

/** `--name: value;` declarations of one block body, as a plain object. */
function variables(body: string | undefined): Record<string, string> {
  if (body === undefined) throw new Error("Block not found");
  return Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? "").trim()]));
}

/** Ordinary (non-variable) declarations, e.g. `font-size: 15px`. */
function declarations(body: string | undefined): Record<string, string> {
  if (body === undefined) throw new Error("Block not found");
  return Object.fromEntries(
    [...body.matchAll(/(?:^|;|\s)([a-z][\w-]*)\s*:\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? "").trim()]),
  );
}

function expectedThemeVariables(theme: Theme): Record<string, string> {
  const themed: ThemedToken[] = [...tokens.color.tokens, ...tokens.shadow.tokens];
  return Object.fromEntries(
    themed.map((token) => {
      const reference = referenceName(token.value[theme]);
      return [token.name, reference ? `var(--${reference})` : token.value[theme]];
    }),
  );
}

const textStyles = tokens.type.groups.flatMap((group) => group.styles.map((style) => ({ ...style, group })));

describe("TC-F00-25 [AC-F00-12] generated tokens.css matches tokens.json exactly", () => {
  const css = blocks(generateCss(tokens));

  it("TC-F00-25 [AC-F00-12] the light block holds every color and shadow token with its light value, and nothing else", () => {
    expect(variables(css.get(LIGHT))).toEqual(expectedThemeVariables("light"));
  });

  it("TC-F00-25 [AC-F00-12] the dark block holds every color and shadow token with its dark value, and nothing else", () => {
    expect(variables(css.get(DARK))).toEqual(expectedThemeVariables("dark"));
  });

  it("TC-F00-25 [AC-F00-12] references such as {accent-sky} become var(--accent-sky), so sky is the default", () => {
    expect(variables(css.get(LIGHT))["accent"]).toBe("var(--accent-sky)");
    expect(variables(css.get(DARK))["focus-ring"]).toBe("var(--accent-sky-text)");
  });

  it.each(ACCENTS.filter((accent) => accent !== "sky"))(
    "TC-F00-25 [AC-F00-12] the %s accent block maps the five aliases to that accent's tokens",
    (accent) => {
      expect(variables(css.get(`[data-accent="${accent}"]`))).toEqual({
        accent: `var(--accent-${accent})`,
        "on-accent": `var(--on-accent-${accent})`,
        "accent-text": `var(--accent-${accent}-text)`,
        "accent-soft": `var(--accent-${accent}-soft)`,
        "focus-ring": `var(--accent-${accent}-text)`,
      });
    },
  );

  it("TC-F00-25 [AC-F00-12] every alias target is a real token", () => {
    const names = new Set(tokens.color.tokens.map((token) => token.name));
    for (const accent of ACCENTS.filter((name) => name !== "sky")) {
      for (const value of Object.values(variables(css.get(`[data-accent="${accent}"]`)))) {
        expect(names.has(referenceName(value.replace(/^var\(--(.+)\)$/, "{$1}")) ?? ""), value).toBe(true);
      }
    }
  });

  it("TC-F00-25 [AC-F00-12] spacing, radius and font families sit in the shared :root block", () => {
    expect(variables(css.get(":root"))).toEqual({
      ...Object.fromEntries(tokens.spacing.tokens.map((token) => [token.name, token.value])),
      ...Object.fromEntries(tokens.radius.tokens.map((token) => [token.name, token.value])),
      "font-sans": tokens.type.families.sans,
      "font-mono": tokens.type.families.mono,
    });
  });

  it("TC-F00-25 [AC-F00-12] there are no blocks other than the themes, accents, shared :root and text styles", () => {
    const expected = [
      LIGHT,
      DARK,
      ...ACCENTS.filter((accent) => accent !== "sky").map((accent) => `[data-accent="${accent}"]`),
      ":root",
      ...textStyles.map((style) => `.${style.name}`),
    ];
    expect([...css.keys()].sort()).toEqual(expected.sort());
  });

  it("TC-F00-25 [AC-F00-12] no CSS variable exists that is not a token or an accent alias", () => {
    const allowed = new Set([
      ...tokens.color.tokens.map((token) => token.name),
      ...tokens.shadow.tokens.map((token) => token.name),
      ...tokens.spacing.tokens.map((token) => token.name),
      ...tokens.radius.tokens.map((token) => token.name),
      "font-sans",
      "font-mono",
    ]);
    const defined = [...css.values()].flatMap((body) => Object.keys(variables(body)));
    expect(defined.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it.each(textStyles)("TC-F00-25 [AC-F00-12] text style .$name matches tokens.json", (style) => {
    expect(declarations(css.get(`.${style.name}`))).toEqual({
      "font-family": `var(--font-${style.group.family})`,
      "font-size": style.fontSize,
      "line-height": style.lineHeight,
      "font-weight": String(style.fontWeight),
      ...(style.letterSpacing ? { "letter-spacing": style.letterSpacing } : {}),
    });
  });
});

describe("TC-F00-25 [AC-F00-12] generated theme.css is a Tailwind theme of tokens only", () => {
  const theme = generateTheme(tokens);
  const themeBlocks = blocks(theme);
  const inline = themeBlocks.get("@theme inline reference");

  it("TC-F00-25 [AC-F00-12] theme.css starts with an @theme inline reference block", () => {
    expect(
      theme
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trimStart()
        .startsWith("@theme inline reference {"),
    ).toBe(true);
  });

  it.each(["color", "radius", "shadow", "font", "text"])(
    "TC-F00-25 [AC-F00-12] Tailwind's own --%s-* values are reset",
    (namespace) => {
      expect(inline).toContain(`--${namespace}-*: initial;`);
    },
  );

  it("TC-F00-25 [AC-F00-12] every shared color token becomes a --color-* pointing at its CSS variable", () => {
    const shared = tokens.color.tokens.filter(
      (token) =>
        !ACCENTS.some((accent) => token.name === `on-accent-${accent}` || token.name.startsWith(`accent-${accent}`)),
    );
    const colors = Object.entries(variables(inline)).filter(([name]) => name.startsWith("color-"));
    expect(Object.fromEntries(colors)).toEqual(
      Object.fromEntries(shared.map((token) => [`color-${token.name}`, `var(--${token.name})`])),
    );
  });

  it("TC-F00-25 [AC-F00-12] no accent-<name> color class exists (components use the aliases only)", () => {
    const names = ACCENTS.join("|");
    expect(theme).not.toMatch(new RegExp(`--color-(?:on-)?accent-(?:${names})(?=[-:])`));
  });

  it("TC-F00-25 [AC-F00-12] --spacing equals space-1, so p-N is N × space-1", () => {
    const step = tokens.spacing.tokens.find((token) => token.name === "space-1")?.value;
    expect(step).toBe("4px");
    expect(variables(themeBlocks.get("@theme"))).toEqual({ spacing: step });
  });

  it.each(tokens.spacing.tokens)(
    "TC-F00-25 [AC-F00-12] $name equals its number × space-1 (p-N == space-N)",
    (token) => {
      const steps = Number(/^space-(\d+)$/.exec(token.name)?.[1]);
      expect(token.value).toBe(`${String(steps * 4)}px`);
    },
  );
});

describe("TC-F00-25 [AC-F00-12] generated tokens.ts lists the accents from tokens.json", () => {
  const types = generateTypes(tokens);

  it("TC-F00-25 [AC-F00-12] ACCENTS has the 8 accents of tokens.json, in order, and sky is the default", () => {
    const listed = JSON.parse(/export const ACCENTS = (\[[^\]]*\]) as const;/.exec(types)?.[1] ?? "null") as unknown;
    const inFile = tokens.color.tokens.flatMap((token) => /^on-accent-([a-z]+)$/.exec(token.name)?.[1] ?? []);
    expect(listed).toEqual(inFile);
    expect(inFile).toHaveLength(8);
    expect(types).toContain('export const DEFAULT_ACCENT: Accent = "sky";');
  });

  it("TC-F00-25 [AC-F00-12] TEXT_STYLES lists every text style of tokens.json", () => {
    const listed = JSON.parse(
      /export const TEXT_STYLES = (\[[^\]]*\]) as const;/.exec(types)?.[1] ?? "null",
    ) as unknown;
    expect(listed).toEqual(textStyles.map((style) => style.name));
  });
});
