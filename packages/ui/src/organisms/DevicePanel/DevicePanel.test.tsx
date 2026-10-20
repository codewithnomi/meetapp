// DevicePanel tests (AC-F02-09, 30, 31, 44): the three device lists report choices, the level is a
// meter, Test speakers and the noise switch work from the keyboard, and a note is read out.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DevicePanel, type DevicePanelProps } from "./DevicePanel.tsx";

const OPTIONS = [
  { value: "a", label: "Device A" },
  { value: "b", label: "Device B" },
];

function props(overrides: Partial<DevicePanelProps> = {}): DevicePanelProps {
  return {
    title: "Device settings",
    closeLabel: "Close device settings",
    onClose: vi.fn(),
    camera: { label: "Camera", value: "a", options: OPTIONS, onChange: vi.fn() },
    microphone: {
      label: "Microphone",
      value: "a",
      options: OPTIONS,
      onChange: vi.fn(),
      level: 6,
      levelLabel: "Microphone level",
    },
    speakers: {
      label: "Speakers",
      value: "a",
      options: OPTIONS,
      onChange: vi.fn(),
      test: { label: "Test speakers", onClick: vi.fn() },
    },
    noiseSuppression: { label: "Noise suppression", description: "Cuts noise.", checked: true, onChange: vi.fn() },
    ...overrides,
  };
}

describe("DevicePanel", () => {
  it("TC-F02-86 [AC-F02-09] [AC-F02-31] each list reports its device; the level is a meter", async () => {
    const onChange = vi.fn();
    render(
      <DevicePanel
        {...props({
          speakers: {
            label: "Speakers",
            value: "a",
            options: OPTIONS,
            onChange,
            test: { label: "Test speakers", onClick: vi.fn() },
          },
        })}
      />,
    );
    for (const name of ["Camera", "Microphone", "Speakers"])
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Speakers" }), "Device B");
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("meter", { name: "Microphone level" })).toHaveAttribute("aria-valuenow", "6");
  });

  it("TC-F02-86 [AC-F02-30] [AC-F02-44] noise suppression is a switch; Test speakers works with Enter", async () => {
    const onNoise = vi.fn();
    const onTest = vi.fn();
    render(
      <DevicePanel
        {...props({
          noiseSuppression: {
            label: "Noise suppression",
            description: "Cuts noise.",
            checked: true,
            onChange: onNoise,
          },
          speakers: {
            label: "Speakers",
            value: "a",
            options: OPTIONS,
            onChange: vi.fn(),
            test: { label: "Test speakers", onClick: onTest },
          },
        })}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Noise suppression" });
    expect(toggle).toBeChecked();
    toggle.focus();
    await userEvent.keyboard(" ");
    expect(onNoise).toHaveBeenCalledWith(false);
    screen.getByRole("button", { name: "Test speakers" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-31] a note is read out", () => {
    render(
      <DevicePanel
        {...props({ note: { title: "AirPods Pro disconnected.", text: "Now using MacBook Pro Speakers." } })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("AirPods Pro disconnected. Now using MacBook Pro Speakers.");
  });
});
