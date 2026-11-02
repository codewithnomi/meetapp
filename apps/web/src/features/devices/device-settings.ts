// Settings → Devices (F15 AC-F15-29): the remembered choices, a live camera and microphone for the
// preview and level meter (always on while the page is open), and the device lists. A chosen device
// that isn't connected any more is reported, and the computer's default is used (F02 AC-31).
import { useState } from "react";
import { loadPrefs, savePrefs, type DevicePrefs } from "./device-prefs.ts";
import { useDeviceLists, useLocalDevice, useMicLevel } from "./local-media.ts";

type Kind = "camera" | "microphone" | "speakers";

/** Which chosen devices are missing from the computer's lists (an empty choice means the default). */
export function missingDevices(
  prefs: Pick<DevicePrefs, "cameraId" | "microphoneId" | "speakerId">,
  lists: Record<"cameras" | "microphones" | "speakers", { deviceId: string }[]>,
): Kind[] {
  const gone = (id: string, list: { deviceId: string }[]) =>
    id !== "" && list.length > 0 && !list.some((d) => d.deviceId === id);
  const missing: Kind[] = [];
  if (gone(prefs.cameraId, lists.cameras)) missing.push("camera");
  if (gone(prefs.microphoneId, lists.microphones)) missing.push("microphone");
  if (gone(prefs.speakerId, lists.speakers)) missing.push("speakers");
  return missing;
}

export function useDeviceSettings() {
  const [prefs, setPrefs] = useState<DevicePrefs>(() => loadPrefs());
  const change = (next: Partial<DevicePrefs>) =>
    setPrefs((old) => {
      const updated = { ...old, ...next };
      savePrefs(updated);
      return updated;
    });
  const camera = useLocalDevice("camera", prefs.cameraId, true);
  const microphone = useLocalDevice("microphone", prefs.microphoneId, true);
  const level = useMicLevel(microphone.stream);
  const lists = useDeviceLists(`${String(Boolean(camera.stream))}${String(Boolean(microphone.stream))}`);
  return { prefs, change, camera, microphone, level, lists, missing: missingDevices(prefs, lists) };
}
