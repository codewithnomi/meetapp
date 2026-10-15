// The person's own camera and microphone before joining (AC-F02-09, 10): the preview, the microphone
// level, the list of devices, and what is wrong with a device. The camera and microphone are asked for
// separately, so one that fails never blocks the other. On macOS the app first asks the computer for
// permission (through the desktop app); a "denied" answer is shown with where to allow it.
import { useEffect, useState } from "react";
import { mediaProblem, type MediaKind, type MediaProblem } from "./media-problems.ts";

interface MediaBridge {
  meetapp?: {
    media?: {
      accessStatus: () => Promise<{ camera: string; microphone: string; screen: string }>;
      requestAccess: (kind: MediaKind) => Promise<boolean>;
    };
  };
}

export interface DeviceLists {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

/** The computer's own answer (macOS, Windows), asking once if it was never decided. */
async function systemStatus(kind: MediaKind): Promise<string | undefined> {
  const media = (window as MediaBridge).meetapp?.media;
  if (!media) return undefined;
  const status = (await media.accessStatus().catch(() => undefined))?.[kind];
  if (status !== "not-determined") return status;
  return (await media.requestAccess(kind).catch(() => false)) ? "granted" : "denied";
}

async function open(kind: MediaKind, deviceId: string): Promise<{ stream?: MediaStream; problem?: MediaProblem }> {
  const denied = mediaProblem(undefined, await systemStatus(kind));
  if (denied) return { problem: denied };
  const choice = deviceId ? { deviceId: { exact: deviceId } } : true;
  const constraints = kind === "camera" ? { video: choice } : { audio: choice };
  try {
    return { stream: await navigator.mediaDevices.getUserMedia(constraints) };
  } catch (error) {
    // A remembered device that is gone: use the default one instead.
    if (deviceId && (error as Error).name === "OverconstrainedError") return open(kind, "");
    return { problem: mediaProblem((error as Error).name) ?? "busy" };
  }
}

const stopAll = (stream: MediaStream | undefined) => stream?.getTracks().forEach((track) => track.stop());

/** One device, while `on`: its stream or its problem. Stops when switched off or changed. */
export function useLocalDevice(kind: MediaKind, deviceId: string, on: boolean) {
  const [state, setState] = useState<{ stream?: MediaStream; problem?: MediaProblem }>({});
  useEffect(() => {
    if (!on) {
      setState({});
      return undefined;
    }
    let live = true;
    let opened: MediaStream | undefined;
    void open(kind, deviceId).then((result) => {
      opened = result.stream;
      if (live) setState(result);
      else stopAll(opened);
    });
    return () => {
      live = false;
      stopAll(opened);
    };
  }, [kind, deviceId, on]);
  return state;
}

/** The microphone's loudness, 0 to 10, about ten times a second. */
export function useMicLevel(stream: MediaStream | undefined): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return undefined;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value - 128)), 0);
      setLevel(Math.min(10, Math.round((peak / 128) * 20)));
    }, 100);
    return () => {
      clearInterval(timer);
      void context.close();
    };
  }, [stream]);
  return level;
}

/** The cameras, microphones and speakers, kept up to date when one is plugged in or out (AC-F02-31). */
export function useDeviceLists(refreshWhen: unknown): DeviceLists {
  const [lists, setLists] = useState<DeviceLists>({ cameras: [], microphones: [], speakers: [] });
  useEffect(() => {
    const read = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) =>
          setLists({
            cameras: devices.filter((d) => d.kind === "videoinput" && d.deviceId),
            microphones: devices.filter((d) => d.kind === "audioinput" && d.deviceId),
            speakers: devices.filter((d) => d.kind === "audiooutput" && d.deviceId),
          }),
        )
        .catch(() => undefined);
    read();
    navigator.mediaDevices.addEventListener("devicechange", read);
    return () => navigator.mediaDevices.removeEventListener("devicechange", read);
  }, [refreshWhen]);
  return lists;
}

/** A short, soft tone through the chosen speakers (AC-F02-09). */
export async function testSpeakers(speakerId: string): Promise<void> {
  const context = new AudioContext() as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (speakerId && context.setSinkId) await context.setSinkId(speakerId).catch(() => undefined);
  const tone = context.createOscillator();
  const volume = context.createGain();
  tone.frequency.value = 660;
  volume.gain.setValueAtTime(0.15, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7);
  tone.connect(volume).connect(context.destination);
  tone.start();
  tone.stop(context.currentTime + 0.7);
  tone.onended = () => void context.close();
}
