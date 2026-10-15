// MeetingOptionsForm tests (AC-F02-02, 34, 36, 37, 44, 45): every option is a named control that
// reports, co-organizers change only when the organizer may, saving waits, and errors are shown.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingOptionsForm, type MeetingOptionsFormProps } from "./MeetingOptionsForm.tsx";

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "workspace", label: "People in my workspace" },
];
const SWITCH = { description: "d", checked: true, onChange: vi.fn() };

function props(overrides: Partial<MeetingOptionsFormProps> = {}): MeetingOptionsFormProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    title: "Meeting options",
    meetingTitle: "Weekly",
    closeLabel: "Close",
    lobbyBypass: { label: "Who can skip the lobby?", value: "workspace", options: AUDIENCES, onChange: vi.fn() },
    whoCanPresent: { label: "Who can present?", value: "everyone", options: AUDIENCES, onChange: vi.fn() },
    coOrganizers: {
      label: "Co-organizers",
      people: [{ id: "omar", name: "Omar Farooq", removeLabel: "Remove Omar Farooq as co-organizer" }],
      hint: "Only the organizer can change this.",
    },
    allowMic: { label: "Allow mic for attendees", ...SWITCH },
    allowCamera: { label: "Allow camera for attendees", ...SWITCH },
    lock: { label: "Lock the meeting", ...SWITCH, checked: false },
    guestsNote: "Guests can join.",
    cancelLabel: "Cancel",
    save: { label: "Save", onClick: vi.fn(), savingLabel: "Saving" },
    ...overrides,
  };
}

describe("MeetingOptionsForm", () => {
  it("TC-F02-86 [AC-F02-02] [AC-F02-44] the choices and switches are named controls that report", async () => {
    const onLobby = vi.fn();
    const onLock = vi.fn();
    render(
      <MeetingOptionsForm
        {...props({
          lobbyBypass: { label: "Who can skip the lobby?", value: "workspace", options: AUDIENCES, onChange: onLobby },
          lock: { label: "Lock the meeting", description: "d", checked: false, onChange: onLock },
        })}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Meeting options" })).toHaveAccessibleDescription("Weekly");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Who can skip the lobby?" }), "Everyone");
    expect(onLobby).toHaveBeenCalledWith("everyone");
    screen.getByRole("switch", { name: "Lock the meeting" }).focus();
    await userEvent.keyboard(" ");
    expect(onLock).toHaveBeenCalledWith(true);
    for (const name of ["Allow mic for attendees", "Allow camera for attendees"])
      expect(screen.getByRole("switch", { name })).toBeChecked();
  });

  it("TC-F02-86 [AC-F02-36] a co-organizer sees the list but can't change it", () => {
    render(<MeetingOptionsForm {...props()} />);
    expect(screen.getByRole("list", { name: "Co-organizers" })).toHaveTextContent("Omar Farooq");
    expect(screen.queryByRole("button", { name: "Remove Omar Farooq as co-organizer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-36] the organizer removes and adds co-organizers", async () => {
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    const onQuery = vi.fn();
    render(
      <MeetingOptionsForm
        {...props({
          coOrganizers: {
            ...props().coOrganizers,
            onRemove,
            add: {
              label: "Add a person from Aria",
              query: "sa",
              onQuery,
              suggestions: [{ id: "sara", name: "Sara Malik", addLabel: "Add Sara Malik as co-organizer" }],
              onAdd,
            },
          },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove Omar Farooq as co-organizer" }));
    expect(onRemove).toHaveBeenCalledWith("omar");
    await userEvent.type(screen.getByRole("searchbox", { name: "Add a person from Aria" }), "r");
    expect(onQuery).toHaveBeenCalledWith("sar");
    await userEvent.click(screen.getByRole("button", { name: "Add Sara Malik as co-organizer" }));
    expect(onAdd).toHaveBeenCalledWith("sara");
  });

  it("TC-F02-86 [AC-F02-45] [AC-F02-46] saving waits and can't be pressed twice; an error is shown", () => {
    const { rerender } = render(
      <MeetingOptionsForm
        {...props({ save: { label: "Save", onClick: vi.fn(), savingLabel: "Saving", saving: true } })}
      />,
    );
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    rerender(<MeetingOptionsForm {...props({ error: "Can't reach MeetApp. Check your connection." })} />);
    expect(screen.getByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
  });
});
