// TC-F00-17 at unit level: importing apply-saved.ts (the renderer entry's first import) puts the saved
// theme and accent on <html> straight away, before any React code runs, so there is no wrong-theme flash.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeColorScheme, resetAppearanceDom } from "../../test-utils/fakeColorScheme.ts";
import { STORAGE_KEY } from "./appearance.ts";

const html = document.documentElement;

async function startRenderer() {
  vi.resetModules();
  await import("./apply-saved.ts");
}

beforeEach(() => {
  resetAppearanceDom();
  fakeColorScheme(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("apply-saved (runs on import, before React)", () => {
  it("TC-F00-17 [AC-F00-08] saved dark + teal are on <html> as soon as the module is imported", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "dark", accent: "teal" }));
    await startRenderer();
    expect(html.dataset.theme).toBe("dark");
    expect(html.dataset.accent).toBe("teal");
  });

  it("TC-F00-21 [AC-F00-10] a fresh profile starts with the sky accent and the computer's theme", async () => {
    await startRenderer();
    expect(html.dataset.accent).toBe("sky");
    expect(html.dataset.theme).toBe("light");
  });

  it("TC-F00-17 [AC-F00-08, AC-F00-09] saved System on a dark computer starts dark", async () => {
    fakeColorScheme(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "system", accent: "blue" }));
    await startRenderer();
    expect(html.dataset.theme).toBe("dark");
    expect(html.dataset.accent).toBe("blue");
  });

  it("TC-F00-18 [AC-F00-08, AC-F00-10] corrupted saved data starts with the defaults", async () => {
    localStorage.setItem(STORAGE_KEY, "{oops");
    await startRenderer();
    expect(html.dataset.theme).toBe("light");
    expect(html.dataset.accent).toBe("sky");
  });
});
