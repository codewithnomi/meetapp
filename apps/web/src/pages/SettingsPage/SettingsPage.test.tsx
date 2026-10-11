// SettingsPage, Appearance section: TC-F00-16, 20 and 21 at component level (default System + sky,
// theme and accent apply to <html> at once, are saved and survive a restart; keyboard works).
import { ACCENTS, type Accent } from "@meetapp/design-tokens";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeColorScheme, resetAppearanceDom } from "../../test-utils/fakeColorScheme.ts";

const html = document.documentElement;
const STORAGE_KEY = "meetapp.appearance";
const ACCENT_NAMES: Record<Accent, string> = {
  sky: "Sky blue",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
  orange: "Orange",
  green: "Green",
  teal: "Teal",
};

/** Simulates starting the app: fresh modules, saved look applied first, then the screen is drawn. */
async function startApp(onBack = vi.fn()) {
  vi.resetModules();
  await import("../../features/appearance/apply-saved.ts");
  const { SettingsPage } = await import("./SettingsPage.tsx");
  const view = render(<SettingsPage onBack={onBack} />);
  return { ...view, onBack, user: userEvent.setup() };
}

const themeGroup = () => screen.getByRole("radiogroup", { name: "Theme" });
const accentGroup = () => screen.getByRole("radiogroup", { name: "Accent color" });
const radio = (name: string) => screen.getByRole("radio", { name });
const saved = (): unknown => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");

beforeEach(() => {
  resetAppearanceDom();
  fakeColorScheme(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("SettingsPage: layout", () => {
  it("TC-F00-16 [AC-F00-08, AC-F00-10] shows the Settings and Appearance headings, both choice groups and a preview", async () => {
    await startApp();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
    const themeNames = Array.from(
      themeGroup().querySelectorAll("[role=radio]"),
      (r) => r.getAttribute("aria-label") ?? r.textContent,
    );
    expect(themeNames).toEqual(["Light", "Dark", "Same as my computer"]);
    const accentNames = Array.from(accentGroup().querySelectorAll("[role=radio]"), (r) => r.getAttribute("aria-label"));
    expect(accentNames).toEqual(ACCENTS.map((accent) => ACCENT_NAMES[accent]));
    expect(screen.getByRole("button", { name: "Start meeting" })).toBeInTheDocument();
  });

  it("TC-F00-16 [AC-F00-08] the Back button goes back", async () => {
    const { onBack, user } = await startApp();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsPage: theme", () => {
  it("TC-F00-21 [AC-F00-10] a fresh profile has Same as my computer and Sky blue chosen, and data-accent sky", async () => {
    await startApp();
    expect(radio("Same as my computer")).toBeChecked();
    expect(radio("Sky blue")).toBeChecked();
    expect(html.dataset.accent).toBe("sky");
    expect(html.dataset.theme).toBe("light");
  });

  it("TC-F00-16 [AC-F00-08, AC-F00-17] picking Dark switches <html> at once and saves it", async () => {
    const { user } = await startApp();
    await user.click(radio("Dark"));
    expect(html.dataset.theme).toBe("dark");
    expect(radio("Dark")).toBeChecked();
    expect(radio("Same as my computer")).not.toBeChecked();
    expect(saved()).toMatchObject({ theme: "dark" });
  });

  it("TC-F00-16 [AC-F00-08] after a restart the app is still dark", async () => {
    const first = await startApp();
    await first.user.click(radio("Dark"));
    first.unmount();
    resetDataAttributesOnly();
    await startApp();
    expect(html.dataset.theme).toBe("dark");
    expect(radio("Dark")).toBeChecked();
  });

  it("TC-F00-32 [AC-F00-14] arrow keys move the theme choice and apply it", async () => {
    const { user } = await startApp();
    await user.click(radio("Dark"));
    await user.keyboard("{ArrowLeft}");
    expect(radio("Light")).toBeChecked();
    expect(radio("Light")).toHaveFocus();
    expect(html.dataset.theme).toBe("light");
    expect(saved()).toMatchObject({ theme: "light" });
  });
});

/** Clears <html> but keeps localStorage, like closing the window and opening it again. */
function resetDataAttributesOnly() {
  delete html.dataset.theme;
  delete html.dataset.accent;
}

describe("SettingsPage: accent", () => {
  it("TC-F00-20 [AC-F00-10] picking each of the 8 accents applies it at once and saves it", async () => {
    const { user } = await startApp();
    for (const accent of ACCENTS) {
      await user.click(radio(ACCENT_NAMES[accent]));
      expect(html.dataset.accent).toBe(accent);
      expect(radio(ACCENT_NAMES[accent])).toBeChecked();
      expect(saved()).toMatchObject({ accent });
    }
  });

  it("TC-F00-20 [AC-F00-10] after a restart the last accent is still applied", async () => {
    const first = await startApp();
    await first.user.click(radio("Teal"));
    first.unmount();
    resetDataAttributesOnly();
    await startApp();
    expect(html.dataset.accent).toBe("teal");
    expect(radio("Teal")).toBeChecked();
  });

  it("TC-F00-32 [AC-F00-14] arrow keys move the accent choice and apply it", async () => {
    const { user } = await startApp();
    await user.click(radio("Sky blue"));
    await user.keyboard("{ArrowRight}");
    expect(radio("Blue")).toBeChecked();
    expect(radio("Blue")).toHaveFocus();
    expect(html.dataset.accent).toBe("blue");
  });
});
