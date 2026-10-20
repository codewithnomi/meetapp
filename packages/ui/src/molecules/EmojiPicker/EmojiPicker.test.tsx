// EmojiPicker tests (F03 TC-F03-22): recently used emoji come first and pick at once; the search box is
// named. The full list is Frimousse's, from the app's own data (checked in the desktop tests).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiPicker } from "./EmojiPicker.tsx";

// jsdom has no ResizeObserver; Frimousse uses one to size its list.
vi.hoisted(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const labels = {
  search: "Search emoji",
  recent: "Recently used",
  loading: "Loading…",
  empty: "No emoji found",
  skinTone: "Skin tone",
};

describe("EmojiPicker", () => {
  it("TC-F03-22 [AC-F03-12] recently used emoji come first and are picked with one press", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const onPick = vi.fn();
    render(<EmojiPicker dataUrl="/emojibase" onPick={onPick} recent={["🎉", "👍"]} labels={labels} />);
    const recent = screen.getByRole("region", { name: "Recently used" });
    expect(recent).toHaveTextContent("🎉👍");
    await userEvent.click(screen.getByRole("button", { name: "🎉" }));
    expect(onPick).toHaveBeenCalledWith("🎉");
    expect(screen.getByRole("searchbox", { name: "Search emoji" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
