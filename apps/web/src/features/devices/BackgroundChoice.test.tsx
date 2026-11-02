// The background picker in the app (TC-F15-48, TC-F15-51; AC-F15-30).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundChoice } from "./BackgroundChoice.tsx";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./device-prefs.ts";

const support = vi.hoisted(() => ({ on: true }));
vi.mock("@livekit/track-processors", () => ({
  supportsBackgroundProcessors: () => support.on,
  BackgroundProcessor: vi.fn(),
}));

beforeEach(() => {
  support.on = true;
  localStorage.clear();
});

describe("TC-F15-48 background picker", () => {
  it("TC-F15-48 [AC-F15-30] offers None, Blur and at least 8 named pictures, the chosen one marked", () => {
    render(<BackgroundChoice value="blur" onChange={vi.fn()} />);
    const choices = screen.getAllByRole("radio");
    expect(choices.length).toBeGreaterThanOrEqual(10);
    for (const name of ["None", "Blur", "Office", "Living room", "Soft shapes"]) {
      expect(screen.getByRole("radio", { name })).toBeEnabled();
    }
    expect(screen.getByRole("radio", { name: "Blur" })).toBeChecked();
  });

  it("TC-F15-48 [AC-F15-30] choosing one tells the page which", async () => {
    const onChange = vi.fn();
    render(<BackgroundChoice value="none" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Café" }));
    expect(onChange).toHaveBeenCalledWith("cafe");
  });

  it("TC-F15-48 [AC-F15-30] the choice is kept across a reload and defaults to None", () => {
    expect(loadPrefs().background).toBe("none");
    savePrefs({ ...DEFAULT_PREFS, background: "nature" });
    expect(loadPrefs().background).toBe("nature");
  });
});

describe("TC-F15-51 background tool not supported", () => {
  it("TC-F15-51 [AC-F15-30] the options are disabled with the reason", () => {
    support.on = false;
    render(<BackgroundChoice value="none" onChange={vi.fn()} />);
    expect(screen.getByText("Not available on this computer")).toBeInTheDocument();
    for (const option of screen.getAllByRole("radio")) expect(option).toBeDisabled();
  });
});
