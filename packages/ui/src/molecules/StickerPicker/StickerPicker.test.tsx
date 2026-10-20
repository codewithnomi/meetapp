// StickerPicker tests (F03 TC-F03-46): pressing a sticker picks it by name.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StickerPicker } from "./StickerPicker.tsx";

describe("StickerPicker", () => {
  it("TC-F03-46 [AC-F03-26] pressing a sticker picks it", async () => {
    const onPick = vi.fn();
    render(
      <StickerPicker
        label="Stickers"
        stickers={[{ name: "agreed", text: "Agreed", label: "Sticker: Agreed" }]}
        onPick={onPick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sticker: Agreed" }));
    expect(onPick).toHaveBeenCalledWith("agreed");
  });
});
