// ReactionChip tests (F03 TC-F03-23, 76): the count, whether it is the viewer's, and a spoken label.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReactionChip } from "./ReactionChip.tsx";

describe("ReactionChip", () => {
  it("TC-F03-76 [AC-F03-13] [AC-F03-45] says who reacted and toggles with the keyboard", async () => {
    const onClick = vi.fn();
    render(<ReactionChip emoji="👍" count={4} mine label="Thumbs up, 4 people, including you" onClick={onClick} />);
    const chip = screen.getByRole("button", { name: "Thumbs up, 4 people, including you" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveTextContent("4");
    chip.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
