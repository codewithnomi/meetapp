// The device problems the pre-join names (AC-F02-10), and remembered choices (AC-F02-09).
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./device-prefs.ts";
import { mediaProblem } from "./media-problems.ts";

describe("device problems and choices", () => {
  it("TC-F02-20 [AC-F02-10] missing, busy and denied come from the error or the system's status", () => {
    expect(mediaProblem("NotFoundError")).toBe("missing");
    expect(mediaProblem("NotReadableError")).toBe("busy");
    expect(mediaProblem("NotAllowedError")).toBe("denied");
    expect(mediaProblem(undefined, "denied")).toBe("denied");
    expect(mediaProblem(undefined, "granted")).toBeUndefined();
  });

  it("TC-F02-19 [AC-F02-09] choices are saved and read back; a damaged entry gives the defaults", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const prefs = { ...DEFAULT_PREFS, cameraId: "cam-2", microphoneOn: false };
    savePrefs(prefs, storage);
    expect(loadPrefs(storage)).toEqual(prefs);
    store.set("meetapp.devices", "{not json");
    expect(loadPrefs(storage)).toEqual(DEFAULT_PREFS);
  });
});
