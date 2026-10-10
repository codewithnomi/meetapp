// Appearance rules without React: TC-F00-18 (bad saved values fall back), plus the unit-level part of
// TC-F00-16/20/21 (save, load, resolve "System", write data-theme/data-accent on <html>).
import { ACCENTS, DEFAULT_ACCENT } from "@meetapp/design-tokens";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeColorScheme, resetAppearanceDom } from "../../test-utils/fakeColorScheme.ts";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  loadAppearance,
  parseAppearance,
  resolveTheme,
  saveAppearance,
  STORAGE_KEY,
  THEME_CHOICES,
} from "./appearance.ts";

const html = document.documentElement;
const raw = (value: unknown) => JSON.stringify(value);

beforeEach(() => resetAppearanceDom());
afterEach(() => vi.unstubAllGlobals());

describe("appearance defaults", () => {
  it("TC-F00-21 [AC-F00-10] default is System theme and sky accent, saved under meetapp.appearance", () => {
    expect(DEFAULT_APPEARANCE).toEqual({ theme: "system", accent: "sky" });
    expect(DEFAULT_APPEARANCE.accent).toBe(DEFAULT_ACCENT);
    expect(STORAGE_KEY).toBe("meetapp.appearance");
    expect([...THEME_CHOICES].sort()).toEqual(["dark", "light", "system"]);
  });
});

describe("parseAppearance", () => {
  it.each([
    ["nothing saved", null],
    ["empty text", ""],
    ["text that is not JSON", "{not json"],
    ["a number", "42"],
    ["null", "null"],
    ["a list", "[]"],
    ["an empty object", "{}"],
  ])("TC-F00-18 [AC-F00-08] %s gives the defaults", (_name, value) => {
    expect(parseAppearance(value)).toEqual(DEFAULT_APPEARANCE);
  });

  it("TC-F00-18 [AC-F00-08, AC-F00-10] invalid theme and accent fall back to system and sky", () => {
    expect(parseAppearance(raw({ theme: "purple", accent: "<script>" }))).toEqual(DEFAULT_APPEARANCE);
  });

  it("TC-F00-18 [AC-F00-08, AC-F00-10] each field falls back on its own; the valid one is kept", () => {
    expect(parseAppearance(raw({ theme: "dark", accent: "<script>" }))).toEqual({ theme: "dark", accent: "sky" });
    expect(parseAppearance(raw({ theme: "purple", accent: "teal" }))).toEqual({ theme: "system", accent: "teal" });
    expect(parseAppearance(raw({ theme: 1, accent: ["red"] }))).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(raw({ theme: "DARK", accent: "Teal" }))).toEqual(DEFAULT_APPEARANCE);
  });

  it.each(["light", "dark", "system"] as const)("TC-F00-16 [AC-F00-08] keeps a valid theme %s", (theme) => {
    expect(parseAppearance(raw({ theme, accent: "sky" })).theme).toBe(theme);
  });

  it.each(ACCENTS)("TC-F00-20 [AC-F00-10] keeps the valid accent %s", (accent) => {
    expect(parseAppearance(raw({ theme: "light", accent })).accent).toBe(accent);
  });

  it("TC-F00-18 [AC-F00-08] extra unknown fields are dropped", () => {
    expect(parseAppearance(raw({ theme: "dark", accent: "red", evil: "x" }))).toEqual({ theme: "dark", accent: "red" });
  });
});

describe("loadAppearance and saveAppearance", () => {
  it("TC-F00-16 [AC-F00-08] a saved choice survives a save and load round trip in localStorage", () => {
    saveAppearance({ theme: "dark", accent: "teal" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({ theme: "dark", accent: "teal" });
    expect(loadAppearance()).toEqual({ theme: "dark", accent: "teal" });
  });

  it("TC-F00-21 [AC-F00-10] an empty localStorage loads the defaults", () => {
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("TC-F00-18 [AC-F00-08] corrupted saved data loads the defaults", () => {
    localStorage.setItem(STORAGE_KEY, raw({ theme: "purple", accent: "<script>" }));
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("TC-F00-16 [AC-F00-08] reads and writes the given storage under the storage key", () => {
    const getItem = vi.fn(() => raw({ theme: "light", accent: "red" }));
    const setItem = vi.fn();
    expect(loadAppearance({ getItem })).toEqual({ theme: "light", accent: "red" });
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
    saveAppearance({ theme: "dark", accent: "pink" }, { setItem });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]?.[0]).toBe(STORAGE_KEY);
    expect(JSON.parse(String(setItem.mock.calls[0]?.[1]))).toEqual({ theme: "dark", accent: "pink" });
  });

  it("TC-F00-18 [AC-F00-08] a storage that throws (blocked or full) never breaks the app", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(loadAppearance(broken)).toEqual(DEFAULT_APPEARANCE);
    expect(() => saveAppearance({ theme: "dark", accent: "red" }, broken)).not.toThrow();
  });
});

describe("resolveTheme", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
  ] as const)("TC-F00-16 [AC-F00-08] %s with computer dark=%s shows %s", (choice, prefersDark, expected) => {
    expect(resolveTheme(choice, prefersDark)).toBe(expected);
  });
});

describe("applyAppearance", () => {
  it("TC-F00-16 [AC-F00-08] writes the resolved theme and accent on the given element", () => {
    const root = document.createElement("div");
    applyAppearance({ theme: "system", accent: "purple" }, root, true);
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.accent).toBe("purple");
    applyAppearance({ theme: "light", accent: "green" }, root, true);
    expect(root.dataset.theme).toBe("light");
    expect(root.dataset.accent).toBe("green");
  });

  it("TC-F00-21 [AC-F00-10] defaults to <html>, always sets the sky accent, and asks the computer for System", () => {
    fakeColorScheme(true);
    applyAppearance(DEFAULT_APPEARANCE);
    expect(html.dataset.theme).toBe("dark");
    expect(html.dataset.accent).toBe("sky");
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("TC-F00-18 [AC-F00-08, AC-F00-10] invalid saved values never reach the data-* attributes", () => {
    fakeColorScheme(false);
    localStorage.setItem(STORAGE_KEY, raw({ theme: "purple", accent: "<script>" }));
    applyAppearance(loadAppearance());
    expect(html.dataset.theme).toBe("light");
    expect(html.dataset.accent).toBe("sky");
    const attributeValues = Array.from(html.attributes, (attribute) => attribute.value).join(" ");
    expect(attributeValues).not.toContain("purple");
    expect(attributeValues).not.toContain("script");
  });
});
