// Contrast check for every accent in both themes (AC-F00-11, design.md section 7, WCAG 2.2 AA).
// Text needs 4.5:1; focus outlines and control borders need 3:1. Failures name the pair, theme and accent.
import { ACCENTS, THEMES, resolveColor, type Accent, type DesignTokens, type Theme } from "./tokens.ts";

const SURFACES = ["bg", "surface", "surface-raised", "surface-sunken"];
const TEXT = 4.5;
const UI = 3;

export interface ContrastPair {
  foreground: string;
  background: string;
  minimum: number;
}

/** Every pair the design requires, for one accent (theme-independent list). */
export function requiredPairs(): ContrastPair[] {
  const pair = (foreground: string, background: string, minimum: number) => ({ foreground, background, minimum });
  return [
    pair("on-accent", "accent", TEXT),
    ...["bg", "surface", "surface-sunken", "accent-soft"].map((surface) => pair("accent-text", surface, TEXT)),
    ...["ink", "ink-muted", "ink-subtle"].flatMap((ink) => SURFACES.map((surface) => pair(ink, surface, TEXT))),
    ...["focus-ring", "line-strong"].flatMap((line) => SURFACES.map((surface) => pair(line, surface, UI))),
    ...["success", "warning", "danger"].flatMap((status) =>
      [...SURFACES, `${status}-soft`].map((surface) => pair(status, surface, TEXT)),
    ),
    pair("on-danger-fill", "danger-fill", TEXT),
  ];
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Contrast needs a #rrggbb color, got "${hex}"`);
  const [red, green, blue] = [match[1], match[2], match[3]].map((part) => channel(parseInt(part ?? "0", 16)));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

export interface ContrastFailure extends ContrastPair {
  theme: Theme;
  accent: Accent;
  ratio: number;
  message: string;
}

/** Checks every pair × accent × theme. Pairs that don't involve the accent are reported once per theme. */
export function findContrastFailures(tokens: DesignTokens): ContrastFailure[] {
  const combinations = THEMES.flatMap((theme) =>
    ACCENTS.flatMap((accent) => requiredPairs().map((pair) => ({ pair, theme, accent }))),
  );
  const failures: ContrastFailure[] = [];
  const seen = new Set<string>();
  for (const { pair, theme, accent } of combinations) {
    const foreground = resolveColor(tokens, pair.foreground, theme, accent);
    const background = resolveColor(tokens, pair.background, theme, accent);
    const ratio = contrastRatio(foreground, background);
    const key = `${theme}|${pair.foreground}=${foreground}|${pair.background}=${background}`;
    if (ratio >= pair.minimum || seen.has(key)) continue;
    seen.add(key);
    const message = `${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1 in ${theme} mode with the ${accent} accent (needs ${String(pair.minimum)}:1)`;
    failures.push({ ...pair, theme, accent, ratio, message });
  }
  return failures;
}
