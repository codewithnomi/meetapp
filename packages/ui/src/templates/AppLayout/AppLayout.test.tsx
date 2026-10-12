// AppLayout tests (TC-F01-41, AC-F01-16): the side menu is a named navigation with the switcher on top;
// the current item is marked for screen readers, and items report a choice.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout.tsx";

describe("AppLayout", () => {
  it("TC-F01-41 [AC-F01-16] the menu holds the switcher and the items; the current one is marked", async () => {
    const openSettings = vi.fn();
    render(
      <AppLayout
        navLabel="Main"
        switcher={<button type="button">Switcher</button>}
        items={[
          { id: "home", label: "Home", icon: "home", current: true, onSelect: vi.fn() },
          { id: "settings", label: "Settings", icon: "sliders", current: false, onSelect: openSettings },
        ]}
      >
        <main>Content</main>
      </AppLayout>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.firstElementChild).toHaveTextContent("Switcher");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveTextContent("Content");
  });
});
