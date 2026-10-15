// MeetingLayout tests (AC-F02-21, 44): the title is the page's heading, the slots are placed, the lobby
// bar is a named region whose buttons report, and announcements go to one polite live region.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingLayout, type MeetingLayoutProps } from "./MeetingLayout.tsx";

function props(overrides: Partial<MeetingLayoutProps> = {}): MeetingLayoutProps {
  return {
    title: "Weekly",
    stage: <p>Stage</p>,
    panel: <aside aria-label="Panel">Panel</aside>,
    controls: <div role="group" aria-label="Meeting controls" />,
    announcement: "",
    ...overrides,
  };
}

describe("MeetingLayout", () => {
  it("TC-F02-86 [AC-F02-44] the title is the heading; stage, panel and controls are placed", () => {
    render(<MeetingLayout {...props()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Weekly" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("StagePanel");
    expect(screen.getByRole("group", { name: "Meeting controls" })).toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-15] the lobby bar is a named region; View lobby and Admit all report", async () => {
    const view = vi.fn();
    const admitAll = vi.fn();
    render(
      <MeetingLayout
        {...props({
          lobby: {
            label: "Lobby",
            title: "2 people are waiting in the lobby:",
            names: "Daniel Cho, Leo Martins",
            view: { label: "View lobby", onClick: view },
            admitAll: { label: "Admit all", onClick: admitAll },
          },
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Lobby" })).toHaveTextContent("Daniel Cho, Leo Martins");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(view).toHaveBeenCalledTimes(1);
    expect(admitAll).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-21] [AC-F02-44] announcements go to one polite live region", () => {
    const { container, rerender } = render(<MeetingLayout {...props()} />);
    rerender(<MeetingLayout {...props({ announcement: "Sara Malik raised a hand" })} />);
    const live = container.querySelectorAll("[aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveAttribute("aria-live", "polite");
    expect(live[0]).toHaveTextContent("Sara Malik raised a hand");
  });
});
