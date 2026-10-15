// MeetingInfoPanel tests (AC-F02-01, AC-F02-44): the link and details show, Copy and Copy all report,
// "Copied" is read out, and Meeting options shows only when given.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingInfoPanel, type MeetingInfoPanelProps } from "./MeetingInfoPanel.tsx";

function props(overrides: Partial<MeetingInfoPanelProps> = {}): MeetingInfoPanelProps {
  return {
    title: "Meeting info",
    closeLabel: "Close meeting info",
    onClose: vi.fn(),
    link: { label: "Link", value: "https://meetapp.app/m/abc", copyLabel: "Copy", onCopy: vi.fn() },
    details: [
      { label: "Meeting ID", value: "284 615 903 172", mono: true },
      { label: "Passcode", value: "h3Tq9z", mono: true },
    ],
    copyAll: { label: "Copy all details", onClick: vi.fn() },
    ...overrides,
  };
}

describe("MeetingInfoPanel", () => {
  it("TC-F02-86 [AC-F02-01] shows the link, ID and passcode as terms and values", () => {
    render(<MeetingInfoPanel {...props()} />);
    expect(screen.getByText("https://meetapp.app/m/abc")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Meeting ID", "Passcode"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["284 615 903 172", "h3Tq9z"]);
    expect(screen.getByText("h3Tq9z")).toHaveClass("font-mono");
  });

  it("TC-F02-86 [AC-F02-44] Copy and Copy all work from the keyboard; the status is read out", async () => {
    const onCopy = vi.fn();
    const onCopyAll = vi.fn();
    const { rerender } = render(
      <MeetingInfoPanel
        {...props({
          link: { label: "Link", value: "https://meetapp.app/m/abc", copyLabel: "Copy", onCopy },
          copyAll: { label: "Copy all details", onClick: onCopyAll },
        })}
      />,
    );
    screen.getByRole("button", { name: "Copy" }).focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("button", { name: "Copy all details" }).focus();
    await userEvent.keyboard(" ");
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopyAll).toHaveBeenCalledTimes(1);
    rerender(<MeetingInfoPanel {...props({ status: "Link copied" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("TC-F02-86 [AC-F02-02] Meeting options shows only when given", async () => {
    const { rerender } = render(<MeetingInfoPanel {...props()} />);
    expect(screen.queryByRole("button", { name: "Meeting options" })).not.toBeInTheDocument();
    const onOptions = vi.fn();
    rerender(<MeetingInfoPanel {...props({ options: { label: "Meeting options", onClick: onOptions } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Meeting options" }));
    expect(onOptions).toHaveBeenCalledTimes(1);
  });
});
