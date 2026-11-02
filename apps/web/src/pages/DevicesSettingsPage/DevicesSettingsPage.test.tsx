// Settings → Devices with fake media devices (TC-F15-46, AC-F15-29).
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../../features/devices/device-prefs.ts";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { DevicesSettingsPage } from "./DevicesSettingsPage.tsx";

vi.mock("@livekit/track-processors", () => ({
  supportsBackgroundProcessors: () => true,
  BackgroundProcessor: () => ({ switchTo: async () => undefined, processedTrack: undefined }),
}));

const info = (kind: MediaDeviceKind, deviceId: string, label: string) =>
  ({ kind, deviceId, label, groupId: "g" }) as MediaDeviceInfo;
const DEVICES = [
  info("videoinput", "cam1", "Front camera"),
  info("videoinput", "cam2", "Desk camera"),
  info("audioinput", "mic1", "Built-in mic"),
  info("audioinput", "mic2", "Headset mic"),
  info("audiooutput", "spk1", "Laptop speakers"),
  info("audiooutput", "spk2", "Headset speakers"),
];

const sinks: string[] = [];
let started = 0;
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  setSinkId = async (id: string) => void sinks.push(id);
  createAnalyser = () => ({
    fftSize: 0,
    getByteTimeDomainData: (samples: Uint8Array) => samples.fill(200),
  });
  createMediaStreamSource = () => ({ connect: vi.fn() });
  createOscillator = () => {
    const node = {
      frequency: { value: 0 },
      connect: (next: unknown) => next,
      start: () => void started++,
      stop: vi.fn(),
      onended: null,
    };
    return node;
  };
  createGain = () => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: (next: unknown) => next,
  });
  close = async () => undefined;
}

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track], getVideoTracks: () => [] } as unknown as MediaStream;

beforeEach(() => {
  localStorage.clear();
  sinks.length = 0;
  started = 0;
  installFakeAuth(PAT);
  vi.stubGlobal("meetapp", {});
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => stream),
      enumerateDevices: vi.fn(async () => DEVICES),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const open = () => renderWithApp(<DevicesSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);
const saved = () => JSON.parse(localStorage.getItem("meetapp.devices") ?? "{}") as Record<string, unknown>;

describe("TC-F15-46 Settings → Devices", () => {
  it("TC-F15-46 [AC-F15-29] lists the devices of each kind and remembers each pick on this computer", async () => {
    open();
    const camera = await screen.findByRole("combobox", { name: "Camera" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Desk camera" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Headset mic" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Headset speakers" })).toBeInTheDocument();
    await userEvent.selectOptions(camera, "cam2");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Microphone" }), "mic2");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Speakers" }), "spk2");
    expect(saved()).toMatchObject({ cameraId: "cam2", microphoneId: "mic2", speakerId: "spk2" });
  });

  it("TC-F15-46 [AC-F15-29] shows a live camera preview and a moving level meter", async () => {
    const { container } = open();
    await waitFor(() => expect(container.querySelector("video")).not.toBeNull());
    const meter = screen.getByRole("meter");
    await waitFor(() => expect(Number(meter.getAttribute("aria-valuenow"))).toBeGreaterThan(0));
  });

  it("TC-F15-46 [AC-F15-29] Test speakers plays the sound on the chosen speaker", async () => {
    open();
    await screen.findByRole("option", { name: "Headset speakers" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Speakers" }), "spk2");
    await userEvent.click(screen.getByRole("button", { name: "Test speakers" }));
    await waitFor(() => expect(started).toBe(1));
    expect(sinks).toEqual(["spk2"]);
  });

  it("TC-F15-46 [AC-F15-29] the noise suppression switch changes the saved setting", async () => {
    open();
    const toggle = await screen.findByRole("switch", { name: /Noise suppression/ });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(saved()).toMatchObject({ noiseSuppression: false });
  });

  it("TC-F15-47 [AC-F15-29] a remembered device that is unplugged shows a notice", async () => {
    localStorage.setItem("meetapp.devices", JSON.stringify({ cameraId: "gone" }));
    open();
    expect(await screen.findByText(/Your chosen camera isn't connected/)).toBeInTheDocument();
  });
});

describe("TC-F15-48 Settings → Devices background", () => {
  it("TC-F15-48 [AC-F15-30] choosing a background saves it on this computer and it is preselected after a reload", async () => {
    open();
    await userEvent.click(await screen.findByRole("radio", { name: "Blur" }));
    expect(saved()).toMatchObject({ background: "blur" });
    expect(screen.getByRole("radio", { name: "Blur" })).toBeChecked();
    expect(loadPrefs().background).toBe("blur");
  });
});
