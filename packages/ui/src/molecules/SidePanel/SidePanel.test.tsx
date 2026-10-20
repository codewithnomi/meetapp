// SidePanel tests: the panel is named by its title and Close works from the keyboard (AC-F02-44).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidePanel } from "./SidePanel.tsx";

describe("SidePanel", () => {
  it("TC-F02-86 [AC-F02-44] is a region named by its title; Close works with Enter", async () => {
    const onClose = vi.fn();
    render(
      <SidePanel title="Meeting info" closeLabel="Close meeting info" onClose={onClose}>
        <p>Content</p>
      </SidePanel>,
    );
    expect(screen.getByRole("complementary", { name: "Meeting info" })).toHaveTextContent("Content");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Close meeting info" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-44] opening moves focus to the title; Escape closes; focus goes back to the opener", async () => {
    function Frame() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Meeting info
          </button>
          {open ? (
            <SidePanel title="About this meeting" closeLabel="Close" onClose={() => setOpen(false)}>
              <p>Content</p>
            </SidePanel>
          ) : null}
        </>
      );
    }
    render(<Frame />);
    const opener = screen.getByRole("button", { name: "Meeting info" });
    await userEvent.click(opener);
    expect(screen.getByRole("heading", { name: "About this meeting" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
