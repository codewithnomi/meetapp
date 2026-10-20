// DeviceSelect tests: a labelled list that reports the choice, works with the keyboard, and says when
// there is no device (pre-join and device settings, AC-F02-09, AC-F02-10).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeviceSelect } from "./DeviceSelect.tsx";

const OPTIONS = [
  { value: "built-in", label: "MacBook Pro Microphone" },
  { value: "airpods", label: "AirPods Pro" },
];

describe("DeviceSelect", () => {
  it("TC-F02-86 [AC-F02-44] is named by its label and reports the chosen device", async () => {
    const onChange = vi.fn();
    render(
      <DeviceSelect label="Microphone" value="built-in" options={OPTIONS} onChange={onChange} hint="Remembered" />,
    );
    const select = screen.getByRole("combobox", { name: "Microphone" });
    expect(select).toHaveAccessibleDescription("Remembered");
    await userEvent.selectOptions(select, "AirPods Pro");
    expect(onChange).toHaveBeenCalledWith("airpods");
  });

  it("TC-F02-86 [AC-F02-44] is reached with Tab", async () => {
    render(<DeviceSelect label="Speakers" value="built-in" options={OPTIONS} onChange={vi.fn()} />);
    await userEvent.tab();
    expect(screen.getByRole("combobox", { name: "Speakers" })).toHaveFocus();
  });

  it("TC-F02-86 [AC-F02-10] with no device it says so and can't be used", () => {
    render(<DeviceSelect label="Camera" value="" options={[]} emptyLabel="No camera found" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Camera" });
    expect(select).toBeDisabled();
    expect(screen.getByRole("option", { name: "No camera found" })).toBeInTheDocument();
  });
});
