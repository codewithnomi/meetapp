// The "another device" bar (F15 AC-F15-33): both choices, waiting while one runs, and Retry after a failure.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OtherDeviceBar } from "./OtherDeviceBar.tsx";

const base = {
  label: "Call on another device",
  title: "You're in a call on another device",
  callTitle: "Release team",
  join: { label: "Join on this device", onClick: vi.fn() },
  transfer: { label: "Transfer to this device", onClick: vi.fn() },
};

describe("OtherDeviceBar", () => {
  it("TC-F15-43 [AC-F15-33] names the call and offers Join and Transfer", async () => {
    const join = vi.fn();
    const transfer = vi.fn();
    render(
      <OtherDeviceBar
        {...base}
        join={{ ...base.join, onClick: join }}
        transfer={{ ...base.transfer, onClick: transfer }}
      />,
    );
    expect(screen.getByRole("region", { name: "Call on another device" })).toHaveTextContent("Release team");
    await userEvent.click(screen.getByRole("button", { name: "Join on this device" }));
    await userEvent.click(screen.getByRole("button", { name: "Transfer to this device" }));
    expect(join).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it("T-fix-7 [AC-F15-18] while moving, both wait and say so; a failure offers Retry", async () => {
    const { rerender } = render(<OtherDeviceBar {...base} pendingText="Moving the call…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Moving the call…");
    expect(screen.getByRole("button", { name: "Join on this device" })).toBeDisabled();
    const retry = vi.fn();
    rerender(
      <OtherDeviceBar
        {...base}
        error={{ text: "Couldn't join the call.", retry: { label: "Retry", onClick: retry } }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't join the call.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
