// MessageActions tests (F03 TC-F03-21, 23, 26): quick reactions and Reply report back, and the More
// menu holds only the actions given.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageActions } from "./MessageActions.tsx";

describe("MessageActions", () => {
  it("TC-F03-23 TC-F03-26 [AC-F03-13] [AC-F03-14] react, reply and open the menu with the keyboard", async () => {
    const onReact = vi.fn();
    const onReply = vi.fn();
    const onDelete = vi.fn();
    render(
      <MessageActions
        label="Actions for your message"
        quickReactions={[{ emoji: "👍", label: "React with thumbs up", onReact }]}
        reply={{ label: "Reply", onReply }}
        moreLabel="More actions"
        more={[{ id: "delete", label: "Delete", danger: true, onSelect: onDelete }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "React with thumbs up" }));
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onReact).toHaveBeenCalled();
    expect(onReply).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
