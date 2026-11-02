// SeenMark tests (TC-F14-79, AC-F14-24): "Seen" alone, or a focusable mark naming who has seen it.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeenMark } from "./SeenMark.tsx";

describe("SeenMark", () => {
  it("TC-F14-79 [AC-F14-24] one-to-one: just Seen; a group: a mark naming who has seen it", () => {
    const { rerender } = render(<SeenMark label="Seen" />);
    expect(screen.getByText("Seen")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<SeenMark label="Seen" seenBy="Seen by Sara Malik" />);
    expect(screen.getByRole("button", { name: "Seen by Sara Malik" })).toBeInTheDocument();
  });
});
