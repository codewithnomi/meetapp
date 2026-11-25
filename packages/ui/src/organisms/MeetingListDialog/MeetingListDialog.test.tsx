// MeetingListDialog tests (AC-F13-01): the meetings behind "+N more" are listed; one opens; Close closes.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingListDialog } from "./MeetingListDialog.tsx";

describe("MeetingListDialog", () => {
  it("TC-F13-17 [AC-F13-01] lists the meetings; choosing one opens it; Close closes", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <MeetingListDialog
        title="More meetings"
        closeLabel="Close"
        meetings={[
          { id: "1", title: "Retro", time: "16:00", state: "accepted", stateLabel: "Olivia" },
          { id: "2", title: "Sync", time: "17:00", state: "declined", stateLabel: "Mo" },
        ]}
        onOpen={onOpen}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("dialog", { name: "More meetings" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Sync, 17:00, Mo" }));
    expect(onOpen).toHaveBeenCalledWith("2");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
