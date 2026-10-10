// Turns tokens.json into tokens.css (CSS variables per theme and accent), theme.css (the Tailwind v4
// theme) and tokens.ts (typed names). Nothing here invents a value: everything comes from tokens.json.
import { ACCENTS, ACCENT_ALIASES, DEFAULT_ACCENT, referenceName, type DesignTokens, type Theme } from "./tokens.ts";

const HEADER = "/* MeetApp design tokens: generated from tokens.json by @meetapp/design-tokens. Do not edit. */";

function cssValue(value: string): string {
  const reference = referenceName(value);
  return reference ? `var(--${reference})` : value;
}

function themeBlock(tokens: DesignTokens, theme: Theme): string[] {
  return [...tokens.color.tokens, ...tokens.shadow.tokens].map(
    (token) => `  --${token.name}: ${cssValue(token.value[theme])};`,
  );
}

function accentBlock(accent: string): string {
  const lines = Object.entries(ACCENT_ALIASES).map(
    ([alias, target]) => `  --${alias}: var(--${target(accent as (typeof ACCENTS)[number])});`,
  );
  return `[data-accent="${accent}"] {\n${lines.join("\n")}\n}`;
}

function textStyleClasses(tokens: DesignTokens): string[] {
  return tokens.type.groups.flatMap((group) =>
    group.styles.map((style) => {
      const spacing = style.letterSpacing ? ` letter-spacing: ${style.letterSpacing};` : "";
      return `.${style.name} { font-family: var(--font-${group.family}); font-size: ${style.fontSize}; line-height: ${style.lineHeight}; font-weight: ${String(style.fontWeight)};${spacing} }`;
    }),
  );
}

/** Light values on :root, dark on [data-theme="dark"], accents on [data-accent]; sky is the default. */
export function generateCss(tokens: DesignTokens): string {
  const shared = [
    ...tokens.spacing.tokens.map((token) => `  --${token.name}: ${token.value};`),
    ...tokens.radius.tokens.map((token) => `  --${token.name}: ${token.value};`),
    `  --font-sans: ${tokens.type.families.sans};`,
    `  --font-mono: ${tokens.type.families.mono};`,
  ];
  return [
    HEADER,
    `:root, [data-theme="light"] {\n${themeBlock(tokens, "light").join("\n")}\n}`,
    `[data-theme="dark"] {\n${themeBlock(tokens, "dark").join("\n")}\n  color-scheme: dark;\n}`,
    ...ACCENTS.filter((accent) => accent !== DEFAULT_ACCENT).map(accentBlock),
    `:root {\n${shared.join("\n")}\n}`,
    ...textStyleClasses(tokens),
    "",
  ].join("\n");
}
