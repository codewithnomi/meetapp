// ActionMenu tests: the menu lists only the given actions, works with the keyboard, and takes a custom
// button (the React and Leave menus of the meeting, F02).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionMenu } from "./ActionMenu.tsx";

describe("ActionMenu", () => {
  it("TC-F02-86 [AC-F02-44] lists the given actions; Enter opens, arrows move, Enter chooses", async () => {
    const mute = vi.fn();
    const remove = vi.fn();
    render(
      <ActionMenu
        label="Actions for Sara Malik"
        actions={[
          { id: "mute", label: "Mute", onSelect: mute },
          { id: "remove", label: "Remove from meeting", danger: true, onSelect: remove },
        ]}
      />,
    );
    screen.getByRole("button", { name: "Actions for Sara Malik" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Mute", "Remove from meeting"]);
    expect(screen.getByRole("menuitem", { name: "Remove from meeting" })).toHaveClass("text-danger");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mute).not.toHaveBeenCalled();
  });

  it("TC-F02-86 [AC-F02-44] a custom button opens the same menu", async () => {
    const end = vi.fn();
    render(
      <ActionMenu
        label="More ways to leave"
        trigger={<button type="button">More ways to leave</button>}
        actions={[{ id: "end", label: "End meeting", danger: true, onSelect: end }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "More ways to leave" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "End meeting" }));
    expect(end).toHaveBeenCalledTimes(1);
  });
});
