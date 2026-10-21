// PinnedBar tests (F03 TC-F03-36): goes to the pinned message and to the next pin.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PinnedBar } from "./PinnedBar.tsx";

describe("PinnedBar", () => {
  it("TC-F03-36 [AC-F03-19] shows the pin and its place, goes to it and to the next", async () => {
    const onShow = vi.fn();
    const onNext = vi.fn();
    render(
      <PinnedBar
        title="Pinned"
        text="Bilal: Checklist"
        position="1 of 2"
        onShow={onShow}
        next={{ label: "Next pinned message", onNext }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Pinned · Bilal: Checklist/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next pinned message" }));
    expect(onShow).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});
