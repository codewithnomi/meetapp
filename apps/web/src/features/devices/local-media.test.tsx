// The own camera and microphone before joining (AC-F02-09, 10, 31).
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceOptions, testSpeakers, useDeviceLists, useLocalDevice, useMicLevel } from "./local-media.ts";

const stream = () => {
  const stop = vi.fn();
  return { stop, value: { getTracks: () => [{ stop }] } as unknown as MediaStream };
};
function media() {
  const listeners = new Map<string, () => void>();
  const devices = {
    getUserMedia: vi.fn<(constraints?: MediaStreamConstraints) => Promise<MediaStream>>(),
    enumerateDevices: vi.fn<() => Promise<MediaDeviceInfo[]>>(async () => []),
    addEventListener: vi.fn((name: string, fn: () => void) => listeners.set(name, fn)),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: devices });
  return { devices, listeners };
}
const failure = (name: string) => Object.assign(new Error(name), { name });
const bridge = (status: Record<string, string>, requestAccess = vi.fn(async () => true)) =>
  vi.stubGlobal("meetapp", { media: { accessStatus: async () => status, requestAccess } });

beforeEach(() => vi.stubGlobal("meetapp", {}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("opening a device", () => {
  it("TC-F02-17 [AC-F02-09] opens the remembered device exactly, and stops it when switched off", async () => {
    const s = stream();
    const { devices } = media();
    devices.getUserMedia.mockResolvedValue(s.value);
    const { result, rerender } = renderHook(({ on }) => useLocalDevice("camera", "cam-1", on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(result.current.stream).toBe(s.value));
    expect(devices.getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: "cam-1" } } });
    rerender({ on: false });
    await waitFor(() => expect(result.current).toEqual({}));
    expect(s.stop).toHaveBeenCalled();
  });

  it("TC-F02-17 [AC-F02-09] the default microphone is asked for plainly", async () => {
    const { devices } = media();
    devices.getUserMedia.mockResolvedValue(stream().value);
    renderHook(() => useLocalDevice("microphone", "", true));
    await waitFor(() => expect(devices.getUserMedia).toHaveBeenCalledWith({ audio: true }));
  });

  it("TC-F02-18 [AC-F02-10] a remembered device that is gone falls back to the default one", async () => {
    const s = stream();
    const { devices } = media();
    devices.getUserMedia.mockRejectedValueOnce(failure("OverconstrainedError")).mockResolvedValue(s.value);
    const { result } = renderHook(() => useLocalDevice("camera", "gone", true));
    await waitFor(() => expect(result.current.stream).toBe(s.value));
    expect(devices.getUserMedia).toHaveBeenLastCalledWith({ video: true });
  });

  it("TC-F02-18 [AC-F02-10] errors become problems: missing, busy, denied; unknown means busy", async () => {
    const { devices } = media();
    const problem = async (name: string) => {
      devices.getUserMedia.mockRejectedValue(failure(name));
      const { result } = renderHook(() => useLocalDevice("microphone", "", true));
      await waitFor(() => expect(result.current.problem).toBeDefined());
      return result.current.problem;
    };
    expect(await problem("NotFoundError")).toBe("missing");
    expect(await problem("NotReadableError")).toBe("busy");
    expect(await problem("NotAllowedError")).toBe("denied");
    expect(await problem("Weird")).toBe("busy");
  });

  it("TC-F02-18 [AC-F02-10] when the computer denies access the device is never opened", async () => {
    const { devices } = media();
    bridge({ camera: "denied" });
    const { result } = renderHook(() => useLocalDevice("camera", "", true));
    await waitFor(() => expect(result.current.problem).toBe("denied"));
    expect(devices.getUserMedia).not.toHaveBeenCalled();
  });

  it("TC-F02-18 [AC-F02-10] a never-decided access is asked for once; a refusal is denied, an answer granted", async () => {
    const { devices } = media();
    devices.getUserMedia.mockResolvedValue(stream().value);
    const requestAccess = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    bridge({ microphone: "not-determined" }, requestAccess);
    const first = renderHook(() => useLocalDevice("microphone", "", true));
    await waitFor(() => expect(first.result.current.problem).toBe("denied"));
    const second = renderHook(() => useLocalDevice("microphone", "", true));
    await waitFor(() => expect(second.result.current.stream).toBeDefined());
    expect(requestAccess).toHaveBeenCalledWith("microphone");
  });

  it("TC-F02-18 [AC-F02-10] a desktop app that cannot answer lets the browser decide", async () => {
    const { devices } = media();
    devices.getUserMedia.mockResolvedValue(stream().value);
    vi.stubGlobal("meetapp", { media: { accessStatus: async () => Promise.reject(new Error("x")) } });
    const { result } = renderHook(() => useLocalDevice("camera", "", true));
    await waitFor(() => expect(result.current.stream).toBeDefined());
  });

  it("T-fix-3 a device that opens after the screen was left is stopped at once", async () => {
    const s = stream();
    const { devices } = media();
    let open: (v: MediaStream) => void = () => undefined;
    devices.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (open = resolve)));
    const { unmount } = renderHook(() => useLocalDevice("camera", "", true));
    await waitFor(() => expect(devices.getUserMedia).toHaveBeenCalled());
    unmount();
    await act(async () => open(s.value));
    expect(s.stop).toHaveBeenCalled();
  });
});

describe("microphone level", () => {
  function audio(samples: number[]) {
    const close = vi.fn();
    const analyser = {
      fftSize: 0,
      getByteTimeDomainData: (array: Uint8Array) => {
        array.fill(128);
        array.set(samples.slice(0, array.length));
      },
    };
    vi.stubGlobal(
      "AudioContext",
      class {
        createAnalyser = () => analyser;
        createMediaStreamSource = () => ({ connect: vi.fn() });
        close = close;
      },
    );
    return close;
  }

  it("TC-F02-17 [AC-F02-09] the level is the peak 0 to 10, ten times a second, and the clock stops with the stream", () => {
    vi.useFakeTimers();
    const close = audio([128, 128 + 64, 128 - 10]);
    const { result, unmount } = renderHook(() => useMicLevel({} as MediaStream));
    expect(result.current).toBe(0);
    act(() => void vi.advanceTimersByTime(100));
    expect(result.current).toBe(10);
    unmount();
    expect(close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TC-F02-17 [AC-F02-09] a small sound reads low (peak 20 of 128 is 3), and no stream resets to 0", () => {
    vi.useFakeTimers();
    audio([128, 128, 128 + 20]);
    const { result, rerender } = renderHook(({ s }) => useMicLevel(s), {
      initialProps: { s: {} as MediaStream | undefined },
    });
    act(() => void vi.advanceTimersByTime(100));
    expect(result.current).toBe(3);
    rerender({ s: undefined });
    expect(result.current).toBe(0);
  });
});

describe("device lists", () => {
  const info = (kind: string, deviceId: string, label = "") => ({ kind, deviceId, label }) as MediaDeviceInfo;

  it("TC-F02-31 [AC-F02-31] splits devices by kind, drops ones without an id and re-reads on plug and unplug", async () => {
    const { devices, listeners } = media();
    devices.enumerateDevices.mockResolvedValue([
      info("videoinput", "c1"),
      info("audioinput", "m1"),
      info("audiooutput", "s1"),
      info("videoinput", ""),
    ]);
    const { result, unmount } = renderHook(() => useDeviceLists("a"));
    await waitFor(() => expect(result.current.cameras).toHaveLength(1));
    expect([result.current.microphones, result.current.speakers].map((l) => l.length)).toEqual([1, 1]);
    devices.enumerateDevices.mockResolvedValue([]);
    await act(async () => listeners.get("devicechange")?.());
    await waitFor(() => expect(result.current.cameras).toHaveLength(0));
    unmount();
    expect(devices.removeEventListener).toHaveBeenCalledWith("devicechange", expect.any(Function));
  });

  it("TC-F02-31 [AC-F02-31] an unreadable list leaves the lists empty", async () => {
    const { devices } = media();
    devices.enumerateDevices.mockRejectedValue(new Error("x"));
    const { result } = renderHook(() => useDeviceLists("a"));
    await act(async () => void (await Promise.resolve()));
    expect(result.current.cameras).toEqual([]);
  });

  it("TC-F02-17 [AC-F02-09] devices without a name are Camera 1, Camera 2", () => {
    expect(deviceOptions([info("videoinput", "a", "Webcam"), info("videoinput", "b")], "Camera")).toEqual([
      { value: "a", label: "Webcam" },
      { value: "b", label: "Camera 2" },
    ]);
  });
});

describe("speaker test", () => {
  function tone(withSink: boolean) {
    const sink = vi.fn(async () => undefined);
    const osc: {
      start: () => void;
      stop: () => void;
      onended?: () => void;
      connect: () => unknown;
      frequency: object;
    } = {
      start: vi.fn(),
      stop: vi.fn(),
      connect: () => ({ connect: vi.fn() }),
      frequency: {},
    };
    const close = vi.fn();
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0;
        destination = {};
        close = close;
        createOscillator = () => osc;
        createGain = () => ({
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        });
        setSinkId = withSink ? sink : undefined;
      },
    );
    return { sink, osc, close };
  }

  it("TC-F02-17 [AC-F02-09] plays a short tone through the chosen speakers, then closes", async () => {
    const t = tone(true);
    await testSpeakers("spk-1");
    expect(t.sink).toHaveBeenCalledWith("spk-1");
    expect(t.osc.start).toHaveBeenCalled();
    t.osc.onended?.();
    expect(t.close).toHaveBeenCalled();
  });

  it("TC-F02-17 [AC-F02-09] the default speakers, or a browser without sink choice, still play", async () => {
    const t = tone(true);
    await testSpeakers("");
    expect(t.sink).not.toHaveBeenCalled();
    const u = tone(false);
    await testSpeakers("spk-1");
    expect(u.osc.start).toHaveBeenCalled();
  });
});
