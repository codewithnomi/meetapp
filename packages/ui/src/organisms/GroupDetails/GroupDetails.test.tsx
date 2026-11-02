// GroupDetails tests (TC-F14-79, AC-F14-14, 16–18): rename on Enter, add, remove others, leave; the viewer
// has no remove button; "(External)" shows.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupDetails } from "./GroupDetails.tsx";

describe("GroupDetails", () => {
  it("TC-F14-79 [AC-F14-16, AC-F14-17, AC-F14-18] rename, add, remove and leave", async () => {
    const calls = { onRename: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), onLeave: vi.fn(), onClose: vi.fn() };
    render(
      <GroupDetails
        {...calls}
        title="Release team"
        closeLabel="Close"
        nameLabel="Group name"
        name="Release team"
        peopleHeading="People (2)"
        addLabel="Add people"
        leaveLabel="Leave group"
        people={[
          { id: "me", name: "Aisha Khan (you)" },
          { id: "m", name: "Mei Lin", externalLabel: "(External)", removeLabel: "Remove Mei Lin" },
        ]}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Group name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Launch{Enter}");
    expect(calls.onRename).toHaveBeenCalledWith("Launch");
    await userEvent.click(screen.getByRole("button", { name: "Add people" }));
    expect(calls.onAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole("list", { name: "People (2)" })).toHaveTextContent("(External)");
    expect(screen.queryByRole("button", { name: /Remove Aisha/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Mei Lin" }));
    expect(calls.onRemove).toHaveBeenCalledWith("m");
    await userEvent.click(screen.getByRole("button", { name: "Leave group" }));
    expect(calls.onLeave).toHaveBeenCalledOnce();
  });
});
