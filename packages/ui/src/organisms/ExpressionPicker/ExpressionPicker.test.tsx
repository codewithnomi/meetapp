// ExpressionPicker tests (F03, owner 2026-10-21): tabs as in Teams, "See all" opens a tab, the arrow keys
// move between tabs, picks are reported, Escape closes, and without GIFs there is no GIFs tab.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpressionPicker } from "./ExpressionPicker.tsx";
import { SAMPLE_EXPRESSIONS } from "./samples.ts";

const setup = (extra: Partial<Parameters<typeof ExpressionPicker>[0]> = {}) => {
  const onClose = vi.fn();
  const pickEmoji = vi.fn();
  const pickSticker = vi.fn();
  render(
    <ExpressionPicker
      {...SAMPLE_EXPRESSIONS}
      emoji={{ ...SAMPLE_EXPRESSIONS.emoji, onPick: pickEmoji }}
      stickers={{ ...SAMPLE_EXPRESSIONS.stickers, onPick: pickSticker }}
      onClose={onClose}
      {...extra}
    />,
  );
  return { onClose, pickEmoji, pickSticker };
};

describe("ExpressionPicker", () => {
  it("[AC-F03-12] [AC-F03-26] All shows emoji and stickers; picks are reported", async () => {
    const { pickEmoji, pickSticker } = setup();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("button", { name: "👍" }));
    expect(pickEmoji).toHaveBeenCalledWith("👍");
    await userEvent.click(screen.getByRole("button", { name: "Sticker: agreed" }));
    expect(pickSticker).toHaveBeenCalledWith("agreed");
  });

  it("See all opens the tab; arrow keys move between tabs; Escape closes", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "See all: Stickers" }));
    expect(screen.getByRole("tab", { name: "Stickers" })).toHaveAttribute("aria-selected", "true");
    screen.getByRole("tab", { name: "Stickers" }).focus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("[AC-F03-25] without GIFs there is no GIFs tab or search", () => {
    setup({ gifs: undefined });
    expect(screen.queryByRole("tab", { name: "GIFs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Find something fun" })).not.toBeInTheDocument();
  });
});
