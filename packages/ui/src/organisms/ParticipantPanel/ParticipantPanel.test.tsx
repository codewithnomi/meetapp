// ParticipantPanel tests (AC-F02-15, 23, 33, 44): the lobby shows only when given and not empty, Admit
// all and Mute all report, the search reports what is typed, and nobody found is said.
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ParticipantPanel, type ParticipantPanelProps } from "./ParticipantPanel.tsx";

function props(overrides: Partial<ParticipantPanelProps> = {}): ParticipantPanelProps {
  return {
    title: "Participants (2)",
    closeLabel: "Close participants",
    onClose: vi.fn(),
    search: { label: "Find a participant", value: "", onChange: vi.fn() },
    inMeetingTitle: "In the meeting (2)",
    noMatchText: "Nobody matches your search.",
    people: [
      {
        id: "a",
        name: "Sara Malik",
        roleLabel: "Presenter",
        handLabel: "Hand raised",
        micOn: true,
        micLabel: "Microphone on",
        cameraOn: true,
        cameraLabel: "Camera on",
      },
      {
        id: "b",
        name: "Omar Farooq",
        roleLabel: "Attendee",
        micOn: false,
        micLabel: "Muted",
        cameraOn: false,
        cameraLabel: "Camera off",
      },
    ],
    ...overrides,
  };
}

const lobby = (onAdmitAll = vi.fn()) => ({
  title: "Waiting in the lobby (1)",
  admitAll: { label: "Admit all", onClick: onAdmitAll },
  people: [
    {
      id: "w",
      name: "Leo Martins (Guest)",
      admitText: "Admit",
      denyText: "Deny",
      admitLabel: "Admit Leo Martins (Guest)",
      denyLabel: "Deny Leo Martins (Guest)",
      onAdmit: vi.fn(),
      onDeny: vi.fn(),
    },
  ],
});

describe("ParticipantPanel", () => {
  it("TC-F02-86 [AC-F02-23] lists everyone in the given order, with their states", () => {
    render(<ParticipantPanel {...props()} />);
    const list = screen.getByRole("list", { name: "In the meeting (2)" });
    // Each row's text ends with the name and role (the initials come first).
    const rows = within(list)
      .getAllByRole("listitem")
      .map((row) => row.textContent);
    expect(rows).toEqual([
      expect.stringMatching(/Sara MalikPresenter$/),
      expect.stringMatching(/Omar FarooqAttendee$/),
    ]);
    expect(within(list).getByRole("img", { name: "Hand raised" })).toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-15] the lobby shows only when given and not empty; Admit all reports", async () => {
    const { rerender } = render(<ParticipantPanel {...props()} />);
    expect(screen.queryByText("Waiting in the lobby (1)")).not.toBeInTheDocument();
    const onAdmitAll = vi.fn();
    rerender(<ParticipantPanel {...props({ lobby: lobby(onAdmitAll) })} />);
    await userEvent.click(screen.getByRole("button", { name: "Admit all" }));
    expect(onAdmitAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Admit Leo Martins (Guest)" })).toBeInTheDocument();
    rerender(<ParticipantPanel {...props({ lobby: { ...lobby(), people: [] } })} />);
    expect(screen.queryByRole("button", { name: "Admit all" })).not.toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-33] [AC-F02-44] Mute all only when given; search reports what is typed", async () => {
    const onMuteAll = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <ParticipantPanel {...props({ search: { label: "Find a participant", value: "", onChange } })} />,
    );
    expect(screen.queryByRole("button", { name: "Mute all" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Find a participant" }), "s");
    expect(onChange).toHaveBeenCalledWith("s");
    rerender(<ParticipantPanel {...props({ muteAll: { label: "Mute all", onClick: onMuteAll } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Mute all" }));
    expect(onMuteAll).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-45] nobody found is said", () => {
    render(<ParticipantPanel {...props({ people: [] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nobody matches your search.");
  });
});
