// The pre-join choices, remembered on this computer (AC-F02-09): which camera, microphone and speakers,
// and whether the camera and microphone start on. Kept in local storage; if it can't be read, the
// defaults are used.
export interface DevicePrefs {
  cameraId: string;
  microphoneId: string;
  speakerId: string;
  cameraOn: boolean;
  microphoneOn: boolean;
  /** On by default (AC-F02-30). */
  noiseSuppression: boolean;
}

const KEY = "meetapp.devices";
export const DEFAULT_PREFS: DevicePrefs = {
  cameraId: "",
  microphoneId: "",
  speakerId: "",
  cameraOn: true,
  microphoneOn: true,
  noiseSuppression: true,
};

export function loadPrefs(storage: Pick<Storage, "getItem"> = localStorage): DevicePrefs {
  try {
    const saved = JSON.parse(storage.getItem(KEY) ?? "{}") as Partial<Record<keyof DevicePrefs, unknown>>;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    const on = (value: unknown) => (typeof value === "boolean" ? value : true);
    return {
      cameraId: text(saved.cameraId),
      microphoneId: text(saved.microphoneId),
      speakerId: text(saved.speakerId),
      cameraOn: on(saved.cameraOn),
      microphoneOn: on(saved.microphoneOn),
      noiseSuppression: on(saved.noiseSuppression),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: DevicePrefs, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
