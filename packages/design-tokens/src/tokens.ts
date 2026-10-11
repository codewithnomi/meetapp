// The shape of tokens.json (copied unchanged from the approved design system, D029) and helpers to read it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Theme = "light" | "dark";
export const THEMES: Theme[] = ["light", "dark"];
export const ACCENTS = ["sky", "blue", "purple", "pink", "red", "orange", "green", "teal"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "sky";

export interface ThemedToken {
  name: string;
  value: Record<Theme, string>;
}
interface PlainToken {
  name: string;
  value: string;
}
interface TextStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}
export interface DesignTokens {
  color: { tokens: ThemedToken[] };
  type: { families: Record<"sans" | "mono", string>; groups: { family: "sans" | "mono"; styles: TextStyle[] }[] };
  spacing: { tokens: PlainToken[] };
  radius: { tokens: PlainToken[] };
  shadow: { tokens: ThemedToken[] };
}

export const TOKENS_FILE = fileURLToPath(new URL("../tokens.json", import.meta.url));

export function loadTokens(file = TOKENS_FILE): DesignTokens {
  return JSON.parse(readFileSync(file, "utf8")) as DesignTokens;
}

/** "{accent-sky}" refers to another token; returns its name, or undefined for a plain value. */
export function referenceName(value: string): string | undefined {
  return /^\{([a-z0-9-]+)\}$/.exec(value)?.[1];
}

/** The real color of a token in a theme, following references, with an optional accent choice. */
export function resolveColor(
  tokens: DesignTokens,
  name: string,
  theme: Theme,
  accent: Accent = DEFAULT_ACCENT,
): string {
  const byName = new Map(tokens.color.tokens.map((token) => [token.name, token]));
  const aliased = accentAlias(name, accent);
  const token = byName.get(aliased ?? name);
  if (!token) throw new Error(`Unknown color token "${name}"`);
  const value = token.value[theme];
  const reference = referenceName(value);
  return reference && !aliased ? resolveColor(tokens, reference, theme, accent) : value;
}

/** The five accent aliases point at the chosen accent's tokens (e.g. accent-text → accent-blue-text). */
export const ACCENT_ALIASES: Record<string, (accent: Accent) => string> = {
  accent: (accent) => `accent-${accent}`,
  "on-accent": (accent) => `on-accent-${accent}`,
  "accent-text": (accent) => `accent-${accent}-text`,
  "accent-soft": (accent) => `accent-${accent}-soft`,
  "focus-ring": (accent) => `accent-${accent}-text`,
};

function accentAlias(name: string, accent: Accent): string | undefined {
  return ACCENT_ALIASES[name]?.(accent);
}

/** Tokens named after one accent (accent-blue, on-accent-blue, …) exist only to switch accents. */
export function isAccentSpecific(name: string): boolean {
  return ACCENTS.some((accent) => name === `on-accent-${accent}` || name.startsWith(`accent-${accent}`));
}
