// Dialog tests (TC-F01-41, AC-F01-28): the title and description name the dialog for screen readers,
// Escape and Close close it, and keyboard focus moves inside.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.tsx";

function setUp() {
  const onOpenChange = vi.fn();
  render(
    <Dialog
      open
      onOpenChange={onOpenChange}
      title="Create a workspace"
      description="You'll be its owner."
      closeLabel="Close"
    >
      <input aria-label="Workspace name" />
    </Dialog>,
  );
  return onOpenChange;
}

describe("Dialog", () => {
  it("TC-F01-41 [AC-F01-28] can start with focus in a chosen field", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Create" description="Owner." closeLabel="Close" initialFocusId="name">
        <input id="name" aria-label="Workspace name" />
      </Dialog>,
    );
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveFocus();
  });

  it("TC-F01-41 [AC-F01-28] is a named dialog with its description, and focus is inside", () => {
    setUp();
    const dialog = screen.getByRole("dialog", { name: "Create a workspace" });
    expect(dialog).toHaveAccessibleDescription("You'll be its owner.");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("TC-F01-41 [AC-F01-28] Escape and the Close button ask to close", async () => {
    const onOpenChange = setUp();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});
