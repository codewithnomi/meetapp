// WorkspaceSwitcher tests (TC-F01-41, AC-F01-16): every workspace in the given order with the open one
// checked, choosing one by mouse or keyboard, and the create and join items.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.tsx";

const LABELS = {
  menu: "Switch workspace",
  heading: "Your workspaces",
  create: "Create a workspace",
  join: "Join with a link or code",
};
const WORKSPACES = [
  { id: "p", name: "Personal", detail: "Only you" },
  { id: "a", name: "Aria", detail: "Owner" },
  { id: "n", name: "Northwind", detail: "Member" },
];

function setUp() {
  const handlers = { onSelect: vi.fn(), onCreate: vi.fn(), onJoin: vi.fn() };
  render(<WorkspaceSwitcher workspaces={WORKSPACES} currentId="a" labels={LABELS} {...handlers} />);
  return handlers;
}

describe("WorkspaceSwitcher", () => {
  it("TC-F01-41 [AC-F01-16] the button names the open workspace; the menu lists all, in order, the open one checked", async () => {
    setUp();
    const trigger = screen.getByRole("button", { name: "Switch workspace: Aria" });
    await userEvent.click(trigger);
    const items = screen.getAllByRole("menuitemradio");
    // Each item: its initial tile (hidden from screen readers), the name, the detail.
    expect(items.map((item) => item.textContent)).toEqual(["PPersonalOnly you", "AAriaOwner", "NNorthwindMember"]);
    expect(screen.getByRole("menuitemradio", { name: /Aria/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "Create a workspace" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Join with a link or code" })).toBeInTheDocument();
  });

  it("TC-F01-41 [AC-F01-16] choosing another workspace reports it", async () => {
    const { onSelect } = setUp();
    await userEvent.click(screen.getByRole("button", { name: "Switch workspace: Aria" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Northwind/ }));
    expect(onSelect).toHaveBeenCalledWith("n");
  });

  it("TC-F01-41 [AC-F01-28] works with the keyboard: open, arrows, Enter; create and join report", async () => {
    const { onSelect, onCreate, onJoin } = setUp();
    screen.getByRole("button", { name: "Switch workspace: Aria" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("menuitem", { name: "Create a workspace" }));
    expect(onCreate).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Switch workspace: Aria" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Join with a link or code" }));
    expect(onJoin).toHaveBeenCalled();
  });
});
