// SidePanel tests: the panel is named by its title and Close works from the keyboard (AC-F02-44).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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
});
