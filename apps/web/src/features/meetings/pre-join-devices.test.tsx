// The pre-join's devices remember every change at once (AC-F02-09, 10).
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../devices/index.ts";
import { stubNoDevices } from "./fake-visit.ts";
import { usePreJoinDevices } from "./pre-join-devices.ts";

beforeEach(() => {
  localStorage.clear();
  stubNoDevices();
});
afterEach(() => vi.unstubAllGlobals());

describe("pre-join devices", () => {
  it("TC-F02-17 [AC-F02-09] starts from the remembered choices and saves each change at once", async () => {
    localStorage.setItem("meetapp.devices", JSON.stringify({ cameraId: "cam-1", cameraOn: false }));
    const { result } = renderHook(() => usePreJoinDevices());
    expect(result.current.prefs).toMatchObject({ cameraId: "cam-1", cameraOn: false, microphoneOn: true });
    act(() => result.current.change({ microphoneOn: false }));
    act(() => result.current.change({ speakerId: "spk-1" }));
    expect(result.current.prefs).toMatchObject({ cameraId: "cam-1", microphoneOn: false, speakerId: "spk-1" });
    expect(loadPrefs()).toMatchObject({ cameraId: "cam-1", microphoneOn: false, speakerId: "spk-1" });
  });

  it("TC-F02-18 [AC-F02-10] a missing microphone is a problem, not an error; the camera is not opened while off", async () => {
    const { result } = renderHook(() => usePreJoinDevices());
    await waitFor(() => expect(result.current.microphone.problem).toBe("missing"));
    expect(result.current.camera.problem).toBe("missing");
    act(() => result.current.change({ cameraOn: false }));
    await waitFor(() => expect(result.current.camera).toEqual({}));
    expect(result.current.level).toBe(0);
    expect(result.current.lists).toEqual({ cameras: [], microphones: [], speakers: [] });
  });
});
