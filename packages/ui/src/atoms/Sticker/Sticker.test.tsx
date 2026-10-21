// Sticker tests (F03 TC-F03-46): a sticker is described in words for screen readers.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sticker } from "./Sticker.tsx";

describe("Sticker", () => {
  it("TC-F03-46 [AC-F03-25] [AC-F03-26] is described in words", () => {
    render(<Sticker name="great-job" text="Great job" label="Sticker: Great job" />);
    expect(screen.getByRole("img", { name: "Sticker: Great job" })).toBeInTheDocument();
  });
});
