// ControlBar tests (AC-F02-22, 23, 24, 38, 44): every control is a named button in a fixed order, works
// from the keyboard, End meeting only for those given the menu, and the people count is spoken.
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ControlBar, type ControlBarProps } from "./ControlBar.tsx";

function props(overrides: Partial<ControlBarProps> = {}): ControlBarProps {
  return {
    label: "Meeting controls",
    elapsed: "00:18:42",
    mic: { on: true, label: "Mute (⌘⇧M)", onToggle: vi.fn() },
    camera: { on: true, label: "Turn camera off (⌘⇧O)", onToggle: vi.fn() },
    share: { on: false, label: "Share screen", onToggle: vi.fn() },
    hand: { on: false, label: "Raise your hand (⌘⇧K)", onToggle: vi.fn() },
    reactions: { label: "React", actions: [{ id: "like", label: "👍 Like", onSelect: vi.fn() }] },
    more: { label: "More options", active: false, onClick: vi.fn() },
    leave: { label: "Leave", onLeave: vi.fn() },
    people: { label: "Participants, 23", count: 23, active: false, onClick: vi.fn() },
    info: { label: "Meeting info", active: false, onClick: vi.fn() },
    ...overrides,
  };
}

const names = () =>
  within(screen.getByRole("group", { name: "Meeting controls" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

describe("ControlBar", () => {
  it("TC-F02-86 [AC-F02-44] the controls come in the fixed order with their shortcuts in the names", () => {
    render(<ControlBar {...props()} />);
    expect(names()).toEqual([
      "Mute (⌘⇧M)",
      "Turn camera off (⌘⇧O)",
      "Share screen",
      "Raise your hand (⌘⇧K)",
      "React",
      "More options",
      "Leave",
      "Participants, 23",
      "Meeting info",
    ]);
  });

  it("TC-F02-86 [AC-F02-22] [AC-F02-44] the microphone works with Enter and Space; a disabled one doesn't", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ControlBar {...props({ mic: { on: true, label: "Mute (⌘⇧M)", onToggle } })} />);
    screen.getByRole("button", { name: "Mute (⌘⇧M)" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(2);
    rerender(<ControlBar {...props({ mic: { on: false, label: "Mics are off", onToggle, disabled: true } })} />);
    expect(screen.getByRole("button", { name: "Mics are off" })).toBeDisabled();
  });

  it("TC-F02-86 [AC-F02-38] End meeting is in the Leave menu only when given", async () => {
    const onEnd = vi.fn();
    const { rerender } = render(<ControlBar {...props()} />);
    expect(screen.queryByRole("button", { name: "More ways to leave" })).not.toBeInTheDocument();
    const leave = {
      label: "Leave",
      onLeave: vi.fn(),
      menu: {
        label: "More ways to leave",
        actions: [{ id: "end", label: "End meeting", danger: true, onSelect: onEnd }],
      },
    };
    rerender(<ControlBar {...props({ leave })} />);
    screen.getByRole("button", { name: "More ways to leave" }).focus();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-24] a reaction is chosen from the React menu", async () => {
    const like = vi.fn();
    render(
      <ControlBar
        {...props({ reactions: { label: "React", actions: [{ id: "like", label: "👍 Like", onSelect: like }] } })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "👍 Like" }));
    expect(like).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-44] open panels are marked as pressed", () => {
    render(<ControlBar {...props({ info: { label: "Meeting info", active: true, onClick: vi.fn() } })} />);
    expect(screen.getByRole("button", { name: "Meeting info" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Participants, 23" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ControlBar chat button", () => {
  it("TC-F03-15 [AC-F03-07] shows unread messages, up to 99+, and opens the chat", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ControlBar {...props({ chat: { label: "Chat, 3 unread", active: false, unread: 3, onClick } })} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Chat, 3 unread" }));
    expect(onClick).toHaveBeenCalled();
    rerender(<ControlBar {...props({ chat: { label: "Chat, 120 unread", active: false, unread: 120, onClick } })} />);
    expect(screen.getByRole("button", { name: "Chat, 120 unread" })).toHaveTextContent("99+");
  });
});
