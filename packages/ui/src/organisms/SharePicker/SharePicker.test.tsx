// SharePicker tests (AC-F02-25, AC-F02-44): one source chosen with arrow keys, Share only after a choice,
// the kind switch reports, loading and nothing found are said, and the screen-recording message
// replaces the list.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SharePicker, type SharePickerProps } from "./SharePicker.tsx";

const SOURCES = [
  { id: "share-1", name: "Built-in display", thumbnail: "data:image/png;base64,AA==" },
  { id: "share-2", name: "Studio Display", thumbnail: "data:image/png;base64,AA==" },
];

function props(overrides: Partial<SharePickerProps> = {}): SharePickerProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    title: "Choose what to share",
    closeLabel: "Close",
    note: "Everyone in the meeting will see it.",
    kind: {
      label: "Share",
      value: "screen",
      options: [
        { value: "screen", label: "Whole screen" },
        { value: "window", label: "One window" },
      ],
      onChange: vi.fn(),
    },
    sourcesLabel: "Screens",
    sources: SOURCES,
    selectedId: "share-1",
    onSelect: vi.fn(),
    emptyText: "No screens found.",
    cancelLabel: "Cancel",
    share: { label: "Share", onClick: vi.fn() },
    ...overrides,
  };
}

describe("SharePicker", () => {
  it("TC-F02-86 [AC-F02-44] sources are a radio group: arrows choose, Share reports", async () => {
    const onSelect = vi.fn();
    const onShare = vi.fn();
    render(<SharePicker {...props({ onSelect, share: { label: "Share", onClick: onShare } })} />);
    expect(screen.getByRole("dialog", { name: "Choose what to share" })).toHaveAccessibleDescription(
      "Everyone in the meeting will see it.",
    );
    const first = screen.getByRole("radio", { name: "Built-in display" });
    expect(first).toBeChecked();
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenCalledWith("share-2");
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-25] Share waits for a choice; the kind switch reports", async () => {
    const onKind = vi.fn();
    render(<SharePicker {...props({ selectedId: undefined, kind: { ...props().kind, onChange: onKind } })} />);
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "One window" }));
    expect(onKind).toHaveBeenCalledWith("window");
  });

  it("TC-F02-86 [AC-F02-45] loading and nothing found are said", () => {
    const { rerender } = render(<SharePicker {...props({ sources: [], loadingLabel: "Finding screens" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Finding screens");
    rerender(<SharePicker {...props({ sources: [] })} />);
    expect(screen.getByText("No screens found.")).toBeInTheDocument();
  });

  it("TC-F02-112 [AC-F02-25] without screen recording, the message replaces the list and Share", async () => {
    const open = vi.fn();
    render(
      <SharePicker
        {...props({
          blocked: {
            icon: "screen",
            tone: "warning",
            title: "Allow screen recording",
            body: "Turn on MeetApp.",
            primary: { label: "Open System Settings", onClick: open },
          },
        })}
      />,
    );
    expect(screen.queryByRole("radiogroup", { name: "Screens" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open System Settings" }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
