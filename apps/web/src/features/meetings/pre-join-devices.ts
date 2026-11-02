// The pre-join's devices (AC-F02-09, 10): the remembered choices, the camera and microphone opened from
// them, the microphone level, and the device lists. Every change is remembered at once.
import { useState } from "react";
import { loadPrefs, savePrefs, type DevicePrefs } from "../devices/index.ts";
import { useDeviceLists, useLocalDevice, useMicLevel } from "../devices/index.ts";

export function usePreJoinDevices() {
  const [prefs, setPrefs] = useState<DevicePrefs>(() => loadPrefs());
  const change = (next: Partial<DevicePrefs>) =>
    setPrefs((old) => {
      const updated = { ...old, ...next };
      savePrefs(updated);
      return updated;
    });
  const camera = useLocalDevice("camera", prefs.cameraId, prefs.cameraOn);
  const microphone = useLocalDevice("microphone", prefs.microphoneId, prefs.microphoneOn);
  const level = useMicLevel(microphone.stream);
  // Device names show only after access is given, so the lists are read again then.
  const lists = useDeviceLists(`${String(Boolean(camera.stream))}${String(Boolean(microphone.stream))}`);
  return { prefs, change, camera, microphone, level, lists };
}

export type PreJoinDevices = ReturnType<typeof usePreJoinDevices>;
