// The in-call device panel's background picker (TC-F15-48, AC-F15-30).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, type DevicePrefs } from "../../features/devices/device-prefs.ts";
import { DevicesPanel } from "./DevicesPanel.tsx";

vi.mock("@livekit/track-processors", () => ({
  supportsBackgroundProcessors: () => true,
  BackgroundProcessor: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { enumerateDevices: async () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});

function Harness() {
  const [prefs, setPrefs] = useState<DevicePrefs>(DEFAULT_PREFS);
  return <DevicesPanel room={undefined} prefs={prefs} setPrefs={setPrefs} weak={false} onClose={vi.fn()} />;
}

describe("TC-F15-48 in-call background picker", () => {
  it("TC-F15-48 [AC-F15-30] choosing a background saves it in local storage and marks it", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: "Office" }));
    expect(JSON.parse(localStorage.getItem("meetapp.devices") ?? "{}")).toMatchObject({ background: "office" });
    expect(screen.getByRole("radio", { name: "Office" })).toBeChecked();
  });
});
