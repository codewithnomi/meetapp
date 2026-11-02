// Remembered device choices and what happens when one disappears (TC-F15-47, AC-F15-29).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./device-prefs.ts";
import { missingDevices } from "./device-settings.ts";

const d = (deviceId: string) => ({ deviceId });
const lists = { cameras: [d("c1"), d("c2")], microphones: [d("m1")], speakers: [d("s1")] };

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("TC-F15-47 device choices are remembered and fall back", () => {
  it("TC-F15-47 [AC-F15-29] saved choices come back after a reload, on this computer only", () => {
    const chosen = { ...DEFAULT_PREFS, cameraId: "c2", microphoneId: "m1", speakerId: "s1", noiseSuppression: false };
    savePrefs(chosen);
    expect(loadPrefs()).toEqual(chosen);
    expect(localStorage.getItem("meetapp.devices")).toContain("c2");
  });

  it("TC-F15-47 [AC-F15-29] nothing saved gives the defaults", () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("TC-F15-47 [AC-F15-29] a chosen device that is gone is reported, per kind", () => {
    expect(missingDevices({ cameraId: "gone", microphoneId: "m1", speakerId: "gone2" }, lists)).toEqual([
      "camera",
      "speakers",
    ]);
  });

  it("TC-F15-47 [AC-F15-29] present devices, the default choice and empty lists report nothing", () => {
    expect(missingDevices({ cameraId: "c1", microphoneId: "", speakerId: "s1" }, lists)).toEqual([]);
    expect(
      missingDevices(
        { cameraId: "c1", microphoneId: "m1", speakerId: "s1" },
        { cameras: [], microphones: [], speakers: [] },
      ),
    ).toEqual([]);
  });
});
