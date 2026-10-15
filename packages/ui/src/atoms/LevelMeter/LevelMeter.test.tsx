// LevelMeter tests: a named meter from 0 to 10 whose filled bars follow the level (pre-join and device
// settings, AC-F02-09, AC-F02-31).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelMeter } from "./LevelMeter.tsx";

const filled = (meter: HTMLElement) => meter.querySelectorAll(".bg-accent").length;

describe("LevelMeter", () => {
  it("TC-F02-86 [AC-F02-44] is a meter named by its label, with as many filled bars as the level", () => {
    render(<LevelMeter label="Microphone level" level={4} />);
    const meter = screen.getByRole("meter", { name: "Microphone level" });
    expect(meter).toHaveAttribute("aria-valuenow", "4");
    expect(meter).toHaveAttribute("aria-valuemax", "10");
    expect(filled(meter)).toBe(4);
  });

  it("TC-F02-86 [AC-F02-44] keeps the level between 0 and 10", () => {
    const { rerender } = render(<LevelMeter label="Level" level={14.2} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "10");
    rerender(<LevelMeter label="Level" level={-3} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    rerender(<LevelMeter label="Level" level={Number.NaN} />);
    expect(filled(screen.getByRole("meter"))).toBe(0);
  });
});
