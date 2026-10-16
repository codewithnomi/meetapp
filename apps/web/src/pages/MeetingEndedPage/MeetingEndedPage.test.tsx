// MeetingEndedPage: TC-F02-90 (AC-F02-45), the waiting and error states of Rejoin, and a card for every
// ending in the translation file.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MeetingEndedPage } from "./MeetingEndedPage.tsx";

const base = { onHome: vi.fn(), onTryAgain: vi.fn() };
const lost = { status: "left", leftReason: "dropped" } as const;

describe("TC-F02-90 meeting ended states", () => {
  it("TC-F02-90 [AC-F02-45] a lost connection offers Rejoin", () => {
    render(
      <MeetingEndedPage {...base} outcome={lost} rejoin={{ onRejoin: vi.fn(), pending: false, error: undefined }} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "You've lost connection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejoin" })).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] while Rejoin is working the button is gone, so it can't be pressed twice", () => {
    render(
      <MeetingEndedPage {...base} outcome={lost} rejoin={{ onRejoin: vi.fn(), pending: true, error: undefined }} />,
    );
    expect(screen.queryByRole("button", { name: "Rejoin" })).not.toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] a failed Rejoin shows why in the card", () => {
    const error = "This meeting is locked. Ask the organizer to unlock it.";
    render(<MeetingEndedPage {...base} outcome={lost} rejoin={{ onRejoin: vi.fn(), pending: false, error }} />);
    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it.each([
    [{ status: "denied" }, "You've been denied entry"],
    [{ status: "timed_out" }, "Nobody let you in"],
    [{ status: "removed", actedByName: "Ayesha" }, "You were removed from the meeting"],
    [{ status: "left", leftReason: "ended" }, "The meeting has ended"],
    [{ status: "left", leftReason: "locked" }, "This meeting is locked"],
    [{ status: "left", leftReason: "guests_off" }, "This meeting doesn't allow guests"],
    [undefined, "You left the meeting"],
  ] as const)("TC-F02-90 [AC-F02-45] %j shows %s", (outcome, title) => {
    render(<MeetingEndedPage {...base} outcome={outcome} />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to home" })).toBeInTheDocument();
  });
});
