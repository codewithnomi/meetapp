// Devices during the call (AC-F02-09, 28, 30, 31).
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, loadPrefs } from "../device-prefs.ts";
import { deviceActions, useDeviceChanges, useOwnLineWeak, useSentMicrophone, type DeviceGone } from "./call-devices.ts";
import { FakeRoom } from "./test-support/fake-room.ts";

vi.mock("livekit-client", async (original) => ({
  ...(await original<typeof import("livekit-client")>()),
  Room: (await import("./test-support/fake-room.ts")).FakeRoom,
}));

const asRoom = (room: FakeRoom) => room as unknown as Parameters<typeof useDeviceChanges>[0];
const flush = () => act(async () => void (await Promise.resolve()));

beforeEach(() => {
  FakeRoom.reset();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("device changes", () => {
  it("TC-F02-31 [AC-F02-31] a device missing from the list is gone: default takes over and it is reported", async () => {
    const room = new FakeRoom();
    room.active = { audioinput: "usb-mic" };
    FakeRoom.localDevices = { audioinput: [{ deviceId: "usb-mic", label: "USB mic" }] };
    const onGone = vi.fn<(gone: DeviceGone) => void>();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    expect(onGone).not.toHaveBeenCalled();
    FakeRoom.localDevices = { audioinput: [{ deviceId: "default", label: "Built-in mic" }] };
    await act(async () => void room.emit("mediaDevicesChanged"));
    await flush();
    expect(room.switchActiveDevice).toHaveBeenCalledWith("audioinput", "default");
    expect(onGone).toHaveBeenCalledWith({ kind: "microphone", gone: "USB mic", now: "Built-in mic" });
  });

  it("TC-F02-31 [AC-F02-31] a device with an empty label is still there", async () => {
    const room = new FakeRoom();
    room.active = { videoinput: "cam-1" };
    FakeRoom.localDevices = { videoinput: [{ deviceId: "cam-1", label: "" }] };
    const onGone = vi.fn();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    expect(onGone).not.toHaveBeenCalled();
    expect(room.switchActiveDevice).not.toHaveBeenCalled();
  });

  it("TC-F02-31 [AC-F02-31] the default device and no device in use are never reported", async () => {
    const room = new FakeRoom();
    room.active = { audiooutput: "default" };
    const onGone = vi.fn();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    expect(onGone).not.toHaveBeenCalled();
  });

  it("TC-F02-31 [AC-F02-31] speakers and camera are named; unreadable lists are skipped; no room does nothing", async () => {
    const room = new FakeRoom();
    room.active = { audiooutput: "spk", videoinput: "cam" };
    FakeRoom.getLocalDevices.mockRejectedValueOnce(new Error("no access"));
    FakeRoom.localDevices = { audiooutput: [{ deviceId: "x", label: "Other" }] };
    const onGone = vi.fn<(gone: DeviceGone) => void>();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    await flush();
    expect(onGone).toHaveBeenCalledWith({ kind: "speakers", gone: "", now: "Other" });
    expect(onGone.mock.calls.some(([g]) => g.kind === "camera")).toBe(true);
    renderHook(() => useDeviceChanges(undefined, onGone));
  });

  it("TC-F02-61 [AC-F02-31] speakers that LiveKit already switched away from are still reported", async () => {
    const room = new FakeRoom();
    room.active = { audiooutput: "usb-spk" };
    FakeRoom.localDevices = { audiooutput: [{ deviceId: "usb-spk", label: "USB speakers" }] };
    const onGone = vi.fn<(gone: DeviceGone) => void>();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    room.active = { audiooutput: "default" };
    FakeRoom.localDevices = { audiooutput: [{ deviceId: "default", label: "MacBook speakers" }] };
    await act(async () => void room.emit("mediaDevicesChanged"));
    await flush();
    expect(onGone).toHaveBeenCalledWith({ kind: "speakers", gone: "USB speakers", now: "MacBook speakers" });
  });

  it('TC-F02-61 [AC-F02-31] a gone camera is replaced by a real camera (not "default"), and reported once', async () => {
    const room = new FakeRoom();
    room.active = { videoinput: "usb-cam" };
    FakeRoom.localDevices = { videoinput: [{ deviceId: "usb-cam", label: "USB camera" }] };
    const onGone = vi.fn<(gone: DeviceGone) => void>();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    FakeRoom.localDevices = { videoinput: [{ deviceId: "built-in", label: "FaceTime camera" }] };
    room.switchActiveDevice.mockImplementation(async (kind: string, id: string) => {
      room.active = { ...room.active, [kind]: id };
      return true;
    });
    await act(async () => void room.emit("mediaDevicesChanged"));
    await flush();
    expect(room.switchActiveDevice).toHaveBeenCalledWith("videoinput", "built-in");
    await act(async () => void room.emit("mediaDevicesChanged"));
    await flush();
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-61 [AC-F02-31] speakers chosen after joining are remembered, so their unplugging is reported", async () => {
    const room = new FakeRoom();
    FakeRoom.localDevices = { audiooutput: [{ deviceId: "usb-spk", label: "USB speakers" }] };
    const onGone = vi.fn<(gone: DeviceGone) => void>();
    renderHook(() => useDeviceChanges(asRoom(room), onGone));
    await flush();
    room.active = { audiooutput: "usb-spk" };
    await act(async () => void room.emit("activeDeviceChanged"));
    await flush();
    room.active = { audiooutput: "default" };
    FakeRoom.localDevices = { audiooutput: [{ deviceId: "default", label: "MacBook speakers" }] };
    await act(async () => void room.emit("mediaDevicesChanged"));
    await flush();
    expect(onGone).toHaveBeenCalledWith({ kind: "speakers", gone: "USB speakers", now: "MacBook speakers" });
  });

  it("TC-F02-31 [AC-F02-31] stops listening when the screen closes", () => {
    const room = new FakeRoom();
    const { unmount } = renderHook(() => useDeviceChanges(asRoom(room), vi.fn()));
    expect(room.listenerCount("mediaDevicesChanged")).toBe(1);
    expect(room.listenerCount("activeDeviceChanged")).toBe(1);
    unmount();
    expect(room.listenerCount("mediaDevicesChanged")).toBe(0);
    expect(room.listenerCount("activeDeviceChanged")).toBe(0);
  });
});

describe("choosing devices and noise suppression", () => {
  it("TC-F02-30 [AC-F02-09] choosing a device switches it and remembers the choice", () => {
    const room = new FakeRoom();
    const setPrefs = vi.fn();
    let prefs = DEFAULT_PREFS;
    setPrefs.mockImplementation((next: typeof DEFAULT_PREFS) => (prefs = next));
    deviceActions(asRoom(room), prefs, setPrefs).choose("videoinput", "cam-2");
    deviceActions(asRoom(room), prefs, setPrefs).choose("audioinput", "mic-2");
    deviceActions(asRoom(room), prefs, setPrefs).choose("audiooutput", "spk-2");
    expect(room.switchActiveDevice).toHaveBeenCalledWith("videoinput", "cam-2");
    expect(loadPrefs()).toMatchObject({ cameraId: "cam-2", microphoneId: "mic-2", cameraOn: true });
    expect(setPrefs).toHaveBeenLastCalledWith(expect.objectContaining({ speakerId: "spk-2" }));
  });

  it("TC-F02-30 [AC-F02-09] a switch that fails or no room still remembers the choice", () => {
    const room = new FakeRoom();
    room.switchActiveDevice.mockRejectedValue(new Error("no"));
    deviceActions(asRoom(room), DEFAULT_PREFS, vi.fn()).choose("audioinput", "m");
    deviceActions(undefined, DEFAULT_PREFS, vi.fn()).choose("audioinput", "m2");
    expect(loadPrefs().microphoneId).toBe("m2");
  });

  it("TC-F02-30 [AC-F02-30] noise suppression changes the microphone track and is remembered", () => {
    const room = new FakeRoom();
    const applyConstraints = vi.fn(async () => undefined);
    room.localParticipant.getTrackPublication.mockReturnValue({ track: { mediaStreamTrack: { applyConstraints } } });
    deviceActions(asRoom(room), DEFAULT_PREFS, vi.fn()).noiseSuppression(false);
    expect(applyConstraints).toHaveBeenCalledWith({ noiseSuppression: false });
    expect(loadPrefs().noiseSuppression).toBe(false);
    deviceActions(undefined, DEFAULT_PREFS, vi.fn()).noiseSuppression(true);
    expect(loadPrefs().noiseSuppression).toBe(true);
  });
});

describe("the own line and the sent microphone", () => {
  it("TC-F02-54 [AC-F02-28] weak after 5 bad seconds of the line's own report", async () => {
    vi.useFakeTimers();
    const room = new FakeRoom();
    const report = new Map([["a", { type: "remote-inbound-rtp", fractionLost: 0.2, roundTripTime: 0.01 }]]);
    const getRTCStatsReport = vi.fn(async () => report);
    room.localParticipant.getTrackPublication.mockReturnValue({ track: { getRTCStatsReport } });
    const { result } = renderHook(() => useOwnLineWeak(asRoom(room)));
    for (let i = 0; i < 4; i += 1) await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current).toBe(true);
  });

  it("TC-F02-54 [AC-F02-28] a failing or empty report changes nothing; no room does nothing", async () => {
    vi.useFakeTimers();
    const room = new FakeRoom();
    const getRTCStatsReport = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(new Map());
    room.localParticipant.getTrackPublication.mockReturnValue({ track: { getRTCStatsReport } });
    const { result } = renderHook(() => useOwnLineWeak(asRoom(room)));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(result.current).toBe(false);
    expect(renderHook(() => useOwnLineWeak(undefined)).result.current).toBe(false);
  });

  it("TC-F02-30 [AC-F02-30] the sent microphone is a stream of the published track", () => {
    vi.stubGlobal(
      "MediaStream",
      class {
        tracks: unknown[];
        constructor(tracks: unknown[]) {
          this.tracks = tracks;
        }
      },
    );
    const room = new FakeRoom();
    const mediaStreamTrack = { id: "t" };
    room.localParticipant.getTrackPublication.mockReturnValue({ track: { mediaStreamTrack } });
    const { result } = renderHook(() => useSentMicrophone(asRoom(room)));
    expect((result.current as unknown as { tracks: unknown[] }).tracks).toEqual([mediaStreamTrack]);
    expect(renderHook(() => useSentMicrophone(undefined)).result.current).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
