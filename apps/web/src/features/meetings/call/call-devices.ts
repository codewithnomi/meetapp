// Devices during the call (AC-F02-28, 30, 31): the own line's quality once a second, switching camera,
// microphone or speakers, noise suppression, and moving to the computer's default device within 2
// seconds when the one in use is unplugged (saying which one changed).
import { Room, RoomEvent, Track, type LocalTrack } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import { savePrefs, type DevicePrefs } from "../device-prefs.ts";
import type { MediaKind } from "../media-problems.ts";
import { createWeakDetector, readingOf } from "./weak-connection.ts";

export type DeviceKind = "videoinput" | "audioinput" | "audiooutput";
const PREF: Record<DeviceKind, "cameraId" | "microphoneId" | "speakerId"> = {
  videoinput: "cameraId",
  audioinput: "microphoneId",
  audiooutput: "speakerId",
};

const localTrack = (room: Room, source: Track.Source) =>
  room.localParticipant.getTrackPublication(source)?.track as LocalTrack | undefined;

/** True while the person's own line is weak (5 bad seconds in a row). */
export function useOwnLineWeak(room: Room | undefined): boolean {
  const [weak, setWeak] = useState(false);
  useEffect(() => {
    if (!room) return undefined;
    const detect = createWeakDetector();
    const timer = setInterval(() => {
      const track = localTrack(room, Track.Source.Microphone) ?? localTrack(room, Track.Source.Camera);
      void track
        ?.getRTCStatsReport()
        .then((report) => {
          const reading = report ? readingOf(report) : undefined;
          if (reading) setWeak(detect(reading));
        })
        .catch(() => undefined);
    }, 1_000);
    return () => clearInterval(timer);
  }, [room]);
  return weak;
}

/** The microphone being sent, as a stream for the level meter. */
export function useSentMicrophone(room: Room | undefined): MediaStream | undefined {
  // Read on every render of the call screen, which happens on every room change.
  const track = room ? localTrack(room, Track.Source.Microphone)?.mediaStreamTrack : undefined;
  return useMemo(() => (track ? new MediaStream([track]) : undefined), [track]);
}

export interface DeviceGone {
  kind: MediaKind | "speakers";
  /** What is used now. */
  now: string;
  /** What disappeared. */
  gone: string;
}

const kindName = (kind: DeviceKind): DeviceGone["kind"] =>
  kind === "videoinput" ? "camera" : kind === "audioinput" ? "microphone" : "speakers";

/** When a device in use disappears, the default one takes over and `onGone` says which changed. */
async function checkDevices(room: Room, known: Map<DeviceKind, string>, onGone: (gone: DeviceGone) => void) {
  for (const kind of ["videoinput", "audioinput", "audiooutput"] as const) {
    const active = room.getActiveDevice(kind);
    const devices = await Room.getLocalDevices(kind, false).catch(() => []);
    // Gone means missing from the list (a device without a name is still there).
    const device = devices.find((d) => d.deviceId === active);
    const label = device?.label;
    if (active && active !== "default" && !device) {
      await room.switchActiveDevice(kind, "default").catch(() => false);
      const now = devices.find((d) => d.deviceId === "default")?.label ?? devices[0]?.label ?? "";
      onGone({ kind: kindName(kind), gone: known.get(kind) ?? "", now });
    }
    if (label) known.set(kind, label);
  }
}

export function useDeviceChanges(room: Room | undefined, onGone: (gone: DeviceGone) => void) {
  useEffect(() => {
    if (!room) return undefined;
    const known = new Map<DeviceKind, string>();
    const check = () => void checkDevices(room, known, onGone);
    check();
    room.on(RoomEvent.MediaDevicesChanged, check);
    return () => void room.off(RoomEvent.MediaDevicesChanged, check);
    // `onGone` is read when a change happens.
  }, [room]);
}

/** Switch a device or noise suppression during the call; the choice is remembered (AC-F02-09). */
export function deviceActions(room: Room | undefined, prefs: DevicePrefs, setPrefs: (p: DevicePrefs) => void) {
  const remember = (next: Partial<DevicePrefs>) => {
    const updated = { ...prefs, ...next };
    savePrefs(updated);
    setPrefs(updated);
  };
  return {
    choose: (kind: DeviceKind, deviceId: string) => {
      remember({ [PREF[kind]]: deviceId });
      void room?.switchActiveDevice(kind, deviceId).catch(() => false);
    },
    noiseSuppression: (on: boolean) => {
      remember({ noiseSuppression: on });
      const track = room ? localTrack(room, Track.Source.Microphone)?.mediaStreamTrack : undefined;
      void track?.applyConstraints({ noiseSuppression: on }).catch(() => undefined);
    },
  };
}
