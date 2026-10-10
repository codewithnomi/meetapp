// App shell: TC-F00-16 at component level (home screen → Settings → back home, all in one window).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeColorScheme, resetAppearanceDom } from "../test-utils/fakeColorScheme.ts";
import { App } from "./App.tsx";

beforeEach(() => {
  resetAppearanceDom();
  fakeColorScheme(false);
  // No backend in unit tests: the flag check fails, so every flag is off.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("TC-F00-16 [AC-F00-08] starts on the home screen, opens Settings and goes back", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "MeetApp" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1, name: "MeetApp" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("moves keyboard focus to the new screen's title after a screen change", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.body).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 1, name: "MeetApp" })).toHaveFocus();
  });

  it("TC-F00-19 [AC-F00-09] with System chosen, the app follows the computer switching to dark", async () => {
    const computer = fakeColorScheme(false);
    const { unmount } = render(<App />);
    computer.setDark(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    unmount();
    expect(computer.listenerCount()).toBe(0);
  });
});
