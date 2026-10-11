// Appearance store (Zustand): TC-F00-16/20 at unit level (every change is applied to <html> at once and
// saved), TC-F00-18 (bad saved data starts with defaults) and "System" following the computer (AC-F00-09).
import { ACCENTS } from "@meetapp/design-tokens";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeColorScheme, resetAppearanceDom } from "../../test-utils/fakeColorScheme.ts";
import { STORAGE_KEY } from "./appearance.ts";

const html = document.documentElement;

/** A fresh store, as on app start: its first state is read from localStorage. */
async function freshStore() {
  vi.resetModules();
  return import("./appearance-store.ts");
}

function saved(): unknown {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}

beforeEach(() => resetAppearanceDom());
afterEach(() => vi.unstubAllGlobals());

describe("appearance store: first state", () => {
  it("TC-F00-16 [AC-F00-08] starts from the saved choice", async () => {
    fakeColorScheme(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "dark", accent: "teal" }));
    const { useAppearance } = await freshStore();
    expect(useAppearance.getState()).toMatchObject({ theme: "dark", accent: "teal" });
  });

  it("TC-F00-21 [AC-F00-10] starts with System and sky on a fresh profile", async () => {
    fakeColorScheme(false);
    const { useAppearance } = await freshStore();
    expect(useAppearance.getState()).toMatchObject({ theme: "system", accent: "sky" });
  });

  it("TC-F00-18 [AC-F00-08, AC-F00-10] starts with the defaults when the saved data is invalid", async () => {
    fakeColorScheme(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "purple", accent: "<script>" }));
    const { useAppearance } = await freshStore();
    expect(useAppearance.getState()).toMatchObject({ theme: "system", accent: "sky" });
  });
});

describe("appearance store: changes", () => {
  it("TC-F00-16 [AC-F00-08, AC-F00-17] setTheme('dark') applies to <html> at once and is saved", async () => {
    fakeColorScheme(false);
    const { useAppearance } = await freshStore();
    useAppearance.getState().setTheme("dark");
    expect(html.dataset.theme).toBe("dark");
    expect(useAppearance.getState().theme).toBe("dark");
    expect(saved()).toEqual({ theme: "dark", accent: "sky" });
  });

  it("TC-F00-16 [AC-F00-08] the saved theme is still there after a restart", async () => {
    fakeColorScheme(false);
    (await freshStore()).useAppearance.getState().setTheme("dark");
    const { useAppearance } = await freshStore();
    expect(useAppearance.getState().theme).toBe("dark");
  });

  it("TC-F00-20 [AC-F00-10] setAccent('purple') applies to <html> at once and is saved", async () => {
    fakeColorScheme(false);
    const { useAppearance } = await freshStore();
    useAppearance.getState().setAccent("purple");
    expect(html.dataset.accent).toBe("purple");
    expect(useAppearance.getState().accent).toBe("purple");
    expect(saved()).toEqual({ theme: "system", accent: "purple" });
  });

  it("TC-F00-20 [AC-F00-10] every one of the 8 accents can be chosen and the last one is kept", async () => {
    fakeColorScheme(false);
    const { useAppearance } = await freshStore();
    for (const accent of ACCENTS) {
      useAppearance.getState().setAccent(accent);
      expect(html.dataset.accent).toBe(accent);
    }
    expect((await freshStore()).useAppearance.getState().accent).toBe("teal");
  });

  it("TC-F00-16 [AC-F00-09] choosing System shows the computer's current theme", async () => {
    fakeColorScheme(true);
    const { useAppearance } = await freshStore();
    useAppearance.getState().setTheme("light");
    expect(html.dataset.theme).toBe("light");
    useAppearance.getState().setTheme("system");
    expect(html.dataset.theme).toBe("dark");
  });
});

describe("followSystemTheme", () => {
  it("TC-F00-19 [AC-F00-09] while System is chosen, a change on the computer is applied at once", async () => {
    const computer = fakeColorScheme(false);
    const { useAppearance, followSystemTheme } = await freshStore();
    useAppearance.getState().setTheme("system");
    const stop = followSystemTheme();
    computer.setDark(true);
    expect(html.dataset.theme).toBe("dark");
    computer.setDark(false);
    expect(html.dataset.theme).toBe("light");
    stop();
  });

  it("TC-F00-19 [AC-F00-09] a switch on the computer while the app starts up is not missed", async () => {
    const computer = fakeColorScheme(false);
    const { useAppearance, followSystemTheme } = await freshStore();
    useAppearance.getState().setTheme("system");
    expect(html.dataset.theme).toBe("light");
    // The computer turns dark before the app starts listening (nobody hears this change).
    computer.setDark(true);
    const stop = followSystemTheme();
    expect(html.dataset.theme).toBe("dark");
    stop();
  });

  it("TC-F00-19 [AC-F00-09] with Light chosen, the computer going dark changes nothing", async () => {
    const computer = fakeColorScheme(false);
    const { useAppearance, followSystemTheme } = await freshStore();
    useAppearance.getState().setTheme("light");
    const stop = followSystemTheme();
    computer.setDark(true);
    expect(html.dataset.theme).toBe("light");
    stop();
  });

  it("TC-F00-19 [AC-F00-09] the returned function stops listening", async () => {
    const computer = fakeColorScheme(false);
    const { useAppearance, followSystemTheme } = await freshStore();
    useAppearance.getState().setTheme("system");
    const stop = followSystemTheme();
    expect(computer.listenerCount()).toBe(1);
    stop();
    expect(computer.listenerCount()).toBe(0);
    computer.setDark(true);
    expect(html.dataset.theme).toBe("light");
  });
});
