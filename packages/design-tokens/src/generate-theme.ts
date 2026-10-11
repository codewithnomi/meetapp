// The Tailwind v4 theme: ONLY token classes exist. `--color-*: initial` removes Tailwind's own palette,
// so `bg-blue-500` produces nothing (AC-F00-15). `inline reference` makes classes point at our CSS
// variables (so themes switch at runtime) without Tailwind writing its own copies of them.
import { isAccentSpecific, type DesignTokens } from "./tokens.ts";

function textStyleLines(tokens: DesignTokens): string[] {
  return tokens.type.groups.flatMap((group) =>
    group.styles.flatMap((style) => [
      `  --text-${style.name}: ${style.fontSize};`,
      `  --text-${style.name}--line-height: ${style.lineHeight};`,
      `  --text-${style.name}--font-weight: ${String(style.fontWeight)};`,
      ...(style.letterSpacing ? [`  --text-${style.name}--letter-spacing: ${style.letterSpacing};`] : []),
    ]),
  );
}

export function generateTheme(tokens: DesignTokens): string {
  // Components use the accent aliases only; accent-<name> tokens exist just to switch accents.
  const colors = tokens.color.tokens.filter((token) => !isAccentSpecific(token.name));
  const step = tokens.spacing.tokens.find((token) => token.name === "space-1")?.value ?? "4px";
  const lines = [
    "  --color-*: initial;",
    ...colors.map((token) => `  --color-${token.name}: var(--${token.name});`),
    "  --radius-*: initial;",
    ...tokens.radius.tokens.map((token) => `  --${token.name}: var(--${token.name});`),
    "  --shadow-*: initial;",
    ...tokens.shadow.tokens.map((token) => `  --${token.name}: var(--${token.name});`),
    "  --font-*: initial;",
    "  --font-sans: var(--font-sans);",
    "  --font-mono: var(--font-mono);",
    "  --text-*: initial;",
    ...textStyleLines(tokens),
  ];
  return [
    "/* MeetApp Tailwind theme: generated from tokens.json by @meetapp/design-tokens. Do not edit. */",
    `@theme inline reference {\n${lines.join("\n")}\n}`,
    // Spacing classes (p-4, gap-2 …) are multiples of space-1, matching space-1 … space-10.
    `@theme {\n  --spacing: ${step};\n}`,
    "",
  ].join("\n");
}

/** tokens.ts: typed lists so code can name tokens safely (e.g. the accent picker). */
export function generateTypes(tokens: DesignTokens): string {
  const colors = tokens.color.tokens.filter((token) => !isAccentSpecific(token.name)).map((token) => token.name);
  const styles = tokens.type.groups.flatMap((group) => group.styles.map((style) => style.name));
  return [
    "// Generated from tokens.json by @meetapp/design-tokens. Do not edit.",
    `export const ACCENTS = ["sky", "blue", "purple", "pink", "red", "orange", "green", "teal"] as const;`,
    "export type Accent = (typeof ACCENTS)[number];",
    `export const DEFAULT_ACCENT: Accent = "sky";`,
    `export const THEMES = ["light", "dark"] as const;`,
    "export type Theme = (typeof THEMES)[number];",
    `export const COLOR_TOKENS = ${JSON.stringify(colors)} as const;`,
    "export type ColorToken = (typeof COLOR_TOKENS)[number];",
    `export const TEXT_STYLES = ${JSON.stringify(styles)} as const;`,
    "export type TextStyleName = (typeof TEXT_STYLES)[number];",
    "",
  ].join("\n");
}
