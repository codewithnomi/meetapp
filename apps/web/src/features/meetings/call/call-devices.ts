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

interface InUse {
  id: string;
  label: string;
}

/** What takes over: the computer's default for sound, the first camera for video ("default" isn't a camera). */
function replacementFor(kind: DeviceKind, devices: MediaDeviceInfo[]): MediaDeviceInfo | undefined {
  const fallback = kind === "videoinput" ? undefined : devices.find((d) => d.deviceId === "default");
  return fallback ?? devices.find((d) => d.deviceId !== "default") ?? devices[0];
}

/**
 * When a device in use disappears from the list (by id: a device without a name is still there), another
 * takes over and `onGone` says which changed. LiveKit may already have switched the speakers by itself,
 * so the device remembered from the last check is compared, not only the active one (AC-F02-31).
 */
async function checkKind(
  room: Room,
  kind: DeviceKind,
  known: Map<DeviceKind, InUse>,
  onGone: (gone: DeviceGone) => void,
) {
  const devices = await Room.getLocalDevices(kind, false).catch(() => []);
  const present = (id: string | undefined) => devices.some((d) => d.deviceId === id);
  // On the first check nothing is remembered yet: the active device (name unknown) stands in.
  const first = room.getActiveDevice(kind);
  const before = known.get(kind) ?? (first ? { id: first, label: "" } : undefined);
  if (before && before.id !== "default" && !present(before.id)) {
    const next = replacementFor(kind, devices);
    const active = room.getActiveDevice(kind);
    if (next && (!active || active === before.id || !present(active))) {
      await room.switchActiveDevice(kind, next.deviceId).catch(() => false);
    }
    onGone({ kind: kindName(kind), gone: before.label, now: next?.label ?? "" });
  }
  const id = room.getActiveDevice(kind);
  const now = devices.find((d) => d.deviceId === id);
  if (id && now) known.set(kind, { id, label: now.label });
  else known.delete(kind);
}

async function checkDevices(room: Room, known: Map<DeviceKind, InUse>, onGone: (gone: DeviceGone) => void) {
  for (const kind of ["videoinput", "audioinput", "audiooutput"] as const) await checkKind(room, kind, known, onGone);
}

export function useDeviceChanges(room: Room | undefined, onGone: (gone: DeviceGone) => void) {
  useEffect(() => {
    if (!room) return undefined;
    const known = new Map<DeviceKind, InUse>();
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
