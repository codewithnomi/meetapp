// CallingScreen tests (F15 TC-F15-23; AC-F15-01, 07, 08): the status is announced and the outcome
// buttons and controls show where the page puts them.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CallingScreen } from "./CallingScreen.tsx";

describe("CallingScreen", () => {
  it("TC-F15-23 [AC-F15-01, AC-F15-07, AC-F15-08] shows the state as a status with the page's buttons", () => {
    render(
      <CallingScreen
        heading="Video call · Bilal"
        picture={<span>B</span>}
        ringing={false}
        title="Bilal declined"
        line="They can call you back."
        actions={<button type="button">Call again</button>}
        controls={<button type="button">Close</button>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Bilal declined");
    expect(screen.getByRole("heading", { level: 1, name: "Video call · Bilal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
