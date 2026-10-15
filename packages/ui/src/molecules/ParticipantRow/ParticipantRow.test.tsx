// ParticipantRow tests: the person's states are spoken, not only drawn (AC-F02-21, AC-F02-23), and the
// actions menu holds only what the viewer may do (AC-F02-35, AC-F02-36).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ParticipantRow, type ParticipantRowProps } from "./ParticipantRow.tsx";

const BASE: ParticipantRowProps = {
  name: "Sara Malik",
  roleLabel: "Presenter",
  micOn: false,
  micLabel: "Muted",
  cameraOn: true,
  cameraLabel: "Camera on",
};

const renderRow = (props: Partial<ParticipantRowProps> = {}) =>
  render(
    <ul>
      <ParticipantRow {...BASE} {...props} />
    </ul>,
  );

describe("ParticipantRow", () => {
  it("TC-F02-86 [AC-F02-21] [AC-F02-23] says the role, speaking, hand, microphone and camera in words", () => {
    renderRow({ speaking: true, speakingLabel: "Sara Malik, speaking", handLabel: "Hand raised" });
    expect(screen.getByRole("listitem")).toHaveTextContent("Presenter");
    for (const name of ["Sara Malik, speaking", "Hand raised", "Muted", "Camera on"])
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-44] without actions there is no menu; with them the menu works from the keyboard", async () => {
    const { unmount } = renderRow();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    const remove = vi.fn();
    renderRow({
      actionsLabel: "Actions for Sara Malik",
      actions: [{ id: "remove", label: "Remove", onSelect: remove }],
    });
    screen.getByRole("button", { name: "Actions for Sara Malik" }).focus();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-107 [AC-F02-51] a name that looks like HTML is shown as text", () => {
    renderRow({ name: "<img src=x onerror=alert(1)>" });
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});
