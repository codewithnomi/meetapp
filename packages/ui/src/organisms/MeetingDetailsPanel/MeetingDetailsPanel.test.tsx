// MeetingDetailsPanel tests (AC-F13-05, 16, 20, 28): actions and answer report, unsent invites offer Retry,
// a cancelled meeting shows its note instead of the actions, and links in notes open outside the app.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MeetingDetailsPanel } from "./MeetingDetailsPanel.tsx";
import { detailsExample } from "./fixtures.ts";

describe("MeetingDetailsPanel", () => {
  it("TC-F13-24 [AC-F13-05] shows when, people and details; actions and the answer report", async () => {
    const on = vi.fn();
    render(<MeetingDetailsPanel {...detailsExample(on)} />);
    expect(screen.getByText("Every week on Wednesday, until 30 Dec")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await userEvent.click(screen.getByRole("radio", { name: "Maybe" }));
    expect(on).toHaveBeenCalledTimes(2);
  });

  it("TC-F13-28 [AC-F13-28] a web address in the notes is a link that opens outside; text stays text", () => {
    render(
      <MeetingDetailsPanel
        {...detailsExample(vi.fn())}
        notes={{ label: "Notes", text: "<b>x</b> https://a.example/x" }}
      />,
    );
    const link = screen.getByRole("link", { name: "https://a.example/x" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(screen.getByText(/<b>x<\/b>/)).toBeInTheDocument();
  });

  it("TC-F13-28 [AC-F13-28] a full stop after an address isn't part of the link", () => {
    render(
      <MeetingDetailsPanel {...detailsExample(vi.fn())} notes={{ label: "Notes", text: "See https://a.example/x." }} />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://a.example/x");
  });

  it("TC-F13-39 [AC-F13-31] unsent invites offer Retry; a cancelled meeting hides actions and answer", async () => {
    const retry = vi.fn();
    const { rerender } = render(
      <MeetingDetailsPanel
        {...detailsExample(vi.fn())}
        unsent={{ text: "1 invite couldn't be sent.", retry: { label: "Retry", onClick: retry } }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<MeetingDetailsPanel {...detailsExample(vi.fn())} cancelledNote="This meeting was cancelled." />);
    expect(screen.getByText("This meeting was cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
