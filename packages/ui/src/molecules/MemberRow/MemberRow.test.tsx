// MemberRow tests (TC-F01-61, AC-F01-21, 28): name, email, role and date show; the actions menu holds
// only the given actions and works with the keyboard; without actions there is no menu button.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberRow, type MemberAction } from "./MemberRow.tsx";

function setUp(actions: MemberAction[]) {
  render(
    <table>
      <tbody>
        <MemberRow
          name="Sara Malik"
          email="sara@aria.com"
          roleLabel="Member"
          joined="3 Oct 2026"
          actions={actions}
          actionsLabel="Actions for Sara Malik"
        />
      </tbody>
    </table>,
  );
}

describe("MemberRow", () => {
  it("TC-F01-61 [AC-F01-21] shows the person, role and join date", () => {
    setUp([]);
    expect(screen.getByRole("img", { name: "Sara Malik" })).toBeInTheDocument();
    expect(screen.getByText("sara@aria.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("3 Oct 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("TC-F01-61 [AC-F01-21] the menu lists only the given actions; choosing one reports it", async () => {
    const remove = vi.fn();
    setUp([
      { id: "promote", label: "Make admin", onSelect: vi.fn() },
      { id: "remove", label: "Remove from workspace", danger: true, onSelect: remove },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Actions for Sara Malik" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Make admin",
      "Remove from workspace",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove from workspace" }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("TC-F01-61 [AC-F01-28] works with the keyboard: Enter opens, arrows move, Enter chooses", async () => {
    const promote = vi.fn();
    setUp([{ id: "promote", label: "Make admin", onSelect: promote }]);
    screen.getByRole("button", { name: "Actions for Sara Malik" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(promote).toHaveBeenCalledTimes(1);
  });
});
