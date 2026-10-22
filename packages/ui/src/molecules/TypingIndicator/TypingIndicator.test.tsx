// TypingIndicator tests (TC-F14-79, AC-F14-23): the words are a polite live region; empty shows nothing.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypingIndicator } from "./TypingIndicator.tsx";

describe("TypingIndicator", () => {
  it("TC-F14-79 [AC-F14-23] says who is typing, politely; nothing when nobody is", () => {
    const { rerender } = render(<TypingIndicator text="Bilal is typing…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Bilal is typing…");
    rerender(<TypingIndicator text="" />);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
