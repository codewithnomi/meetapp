// The user's look: theme (light, dark or same as the computer) and accent color (AC-F00-08, AC-F00-10).
// Saved on this device until accounts exist (F01). Anything unexpected in storage falls back to the
// default, so a bad value can never reach the page (TC-F00-18).
import { ACCENTS, DEFAULT_ACCENT, type Accent } from "@meetapp/design-tokens";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export interface Appearance {
  theme: ThemeChoice;
  accent: Accent;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "system", accent: DEFAULT_ACCENT };
export const STORAGE_KEY = "meetapp.appearance";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function readJson(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Each field is checked on its own: a bad accent doesn't throw away a good theme. */
export function parseAppearance(raw: string | null): Appearance {
  const saved = readJson(raw);
  return {
    theme: isOneOf(THEME_CHOICES, saved["theme"]) ? saved["theme"] : DEFAULT_APPEARANCE.theme,
    accent: isOneOf(ACCENTS, saved["accent"]) ? saved["accent"] : DEFAULT_APPEARANCE.accent,
  };
}

/** Storage can be missing or blocked (private mode); then the defaults apply. */
export function loadAppearance(storage: Pick<Storage, "getItem"> = window.localStorage): Appearance {
  try {
    return parseAppearance(storage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(value: Appearance, storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ theme: value.theme, accent: value.accent }));
  } catch {
    // Not saved this time (storage full or blocked); the choice still applies until the app closes.
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): "light" | "dark" {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

/** The tokens switch on these two attributes of <html>, so the whole app changes at once. */
export function applyAppearance(
  value: Appearance,
  root: HTMLElement = document.documentElement,
  prefersDark: boolean = systemPrefersDark(),
): void {
  root.dataset["theme"] = resolveTheme(value.theme, prefersDark);
  root.dataset["accent"] = value.accent;
}

/** Calls `onChange` when the computer switches between light and dark. Returns a stop function. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
