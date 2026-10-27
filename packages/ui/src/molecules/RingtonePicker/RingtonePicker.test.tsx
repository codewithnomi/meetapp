// RingtonePicker tests (F15 TC-F15-53; AC-F15-32): the chosen ringtone is checked, choosing, playing
// and the volume report themselves.
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RingtonePicker } from "./RingtonePicker.tsx";

const options = ["Bright", "Chime", "Pulse", "Classic", "Gentle"].map((name, i) => ({
  id: i + 1,
  name,
  hint: "",
  playLabel: `Play ${name}`,
}));

describe("RingtonePicker", () => {
  it("TC-F15-53 [AC-F15-32] five ringtones, the chosen one checked, play and choose report the ringtone", async () => {
    const on = { change: vi.fn(), play: vi.fn(), volume: vi.fn() };
    render(
      <RingtonePicker
        legend="Ringtone"
        options={options}
        value={1}
        onChange={on.change}
        onPlay={on.play}
        volumeLabel="Ringtone volume"
        volume={70}
        onVolume={on.volume}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Bright/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Pulse/ }));
    expect(on.change).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Play Gentle" }));
    expect(on.play).toHaveBeenCalledWith(5);
    fireEvent.change(screen.getByRole("slider", { name: "Ringtone volume" }), { target: { value: "40" } });
    expect(on.volume).toHaveBeenCalledWith(40);
  });
});
