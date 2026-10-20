// SystemNote tests (F03 TC-F03-66): the note is shown as plain text.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemNote } from "./SystemNote.tsx";

describe("SystemNote", () => {
  it("TC-F03-66 [AC-F03-37] shows the note as text", () => {
    render(<SystemNote text="<b>Aisha</b> turned chat off" />);
    expect(screen.getByText("<b>Aisha</b> turned chat off")).toBeInTheDocument();
  });
});
