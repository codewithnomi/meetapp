// CallNote tests (F15 TC-F15-36; AC-F15-15): running with Join, ended without a button, missed with
// Call back; names are text.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CallNote } from "./CallNote.tsx";

describe("CallNote", () => {
  it("TC-F15-36 [AC-F15-15] a running call says who started it and offers Join", async () => {
    const join = vi.fn();
    render(
      <CallNote
        kind="running"
        text="Sara Malik started a call"
        detail="03:12 · 2 people"
        action={{ label: "Join", onClick: join }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Sara Malik started a call · 03:12 · 2 people");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(join).toHaveBeenCalledOnce();
  });

  it("TC-F15-36 [AC-F15-15] an ended call has its length and people and no button", () => {
    render(<CallNote kind="ended" text="Call ended" detail="1h 05m · Sara, Omar and you" />);
    expect(screen.getByText("Call ended")).toBeInTheDocument();
    expect(screen.getByText(/1h 05m · Sara, Omar and you/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("TC-F15-36 [AC-F15-15] a missed call offers Call back", async () => {
    const back = vi.fn();
    render(
      <CallNote
        kind="missed"
        text="Missed call from <b>Omar</b>"
        detail="17:42"
        action={{ label: "Call back", onClick: back }}
      />,
    );
    expect(screen.getByText("Missed call from <b>Omar</b>")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Call back" }));
    expect(back).toHaveBeenCalledOnce();
  });
});
