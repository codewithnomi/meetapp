// BackgroundPicker tests (F15 TC-F15-48, 51; AC-F15-30, 31): the chosen tile is pressed, a press reports
// the choice, and on a computer that can't run effects the tiles are off with the reason.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackgroundPicker } from "./BackgroundPicker.tsx";

const options = [
  { id: "none", name: "None", kind: "none" as const },
  { id: "blur", name: "Blur", kind: "blur" as const },
  { id: "office", name: "Office", kind: "picture" as const, imageUrl: "office.jpg" },
];

describe("BackgroundPicker", () => {
  it("TC-F15-48 [AC-F15-30] shows the chosen background and reports a new choice", async () => {
    const onChange = vi.fn();
    render(<BackgroundPicker legend="Background" options={options} value="blur" onChange={onChange} />);
    expect(screen.getByRole("radiogroup", { name: "Background" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Blur" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Office" }));
    expect(onChange).toHaveBeenCalledWith("office");
    // One Tab stop on the chosen tile; arrows choose the next one.
    screen.getByRole("radio", { name: "Blur" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("office");
  });

  it("TC-F15-51 [AC-F15-31] unavailable: every tile is off and the reason shows", () => {
    render(
      <BackgroundPicker
        legend="Background"
        options={options}
        value="none"
        onChange={vi.fn()}
        unavailable="Backgrounds aren't available on this computer."
      />,
    );
    for (const name of ["None", "Blur", "Office"]) expect(screen.getByRole("radio", { name })).toBeDisabled();
    expect(screen.getByText("Backgrounds aren't available on this computer.")).toBeInTheDocument();
  });
});
