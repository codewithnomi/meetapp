// MessageCard tests: title, text and buttons from props, read out when live, and names shown as text
// (AC-F02-44, AC-F02-51).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageCard } from "./MessageCard.tsx";

describe("MessageCard", () => {
  it("TC-F02-86 [AC-F02-44] shows the title and text; both buttons report a press", async () => {
    const end = vi.fn();
    const cancel = vi.fn();
    render(
      <MessageCard
        icon="leave"
        tone="danger"
        title="End the meeting for everyone?"
        body="Everyone will leave at once."
        primary={{ label: "End meeting", variant: "danger", onClick: end }}
        secondary={{ label: "Cancel", onClick: cancel }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "End the meeting for everyone?" })).toBeInTheDocument();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-44] a live card is read out: polite as a status, assertive as an alert", () => {
    const { rerender } = render(
      <MessageCard icon="mic-off" tone="neutral" title="Omar muted you" body="b" live="polite" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Omar muted you");
    rerender(
      <MessageCard icon="users" tone="danger" title="You were removed" body="b" live="assertive" headingLevel={1} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("TC-F02-107 [AC-F02-51] a name that looks like HTML stays text", () => {
    render(<MessageCard icon="mic-off" tone="neutral" title="<script>alert(1)</script> muted you" body="b" />);
    expect(screen.getByRole("heading")).toHaveTextContent("<script>alert(1)</script> muted you");
    expect(document.querySelector("script")).toBeNull();
  });
});
