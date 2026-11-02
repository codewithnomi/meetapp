// The mini window's live video (F16 design.md 3.5; owner's choice): while the mini window shows, the
// main window draws the speaker's video (or the shared screen) into a 320 × 180 picture about 15 times
// a second and sends it over the desktop app's private line. Nothing leaves the computer.
import { useEffect, useState } from "react";

const WIDTH = 320;
const HEIGHT = 180;
export const FRAME_EVERY_MS = 66;

interface FrameBridge {
  onFramesWanted: (listener: (wanted: boolean) => void) => () => void;
  sendFrame: (frame: ArrayBuffer) => void;
}

function frameBridge(): FrameBridge | undefined {
  return (window as { meetapp?: { callWindows?: FrameBridge } }).meetapp?.callWindows;
}

/** Draws `video` to fill the picture (cropping the sides or top), as the call screen's tiles do. */
export function cover(width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(WIDTH / width, HEIGHT / height);
  const sw = WIDTH / scale;
  const sh = HEIGHT / scale;
  return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh };
}

function startSending(track: MediaStreamTrack, send: (frame: ArrayBuffer) => void): () => void {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = new MediaStream([track]);
  // A stand-in video that can't start just sends nothing; the mini window then shows the picture.
  void video.play().catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  let busy = false;
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped || busy || !context || video.videoWidth === 0) return;
    const { sx, sy, sw, sh } = cover(video.videoWidth, video.videoHeight);
    context.drawImage(video, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
    busy = true;
    canvas.toBlob(
      (blob) => {
        void blob
          ?.arrayBuffer()
          .then((frame) => {
            if (!stopped) send(frame);
          })
          .finally(() => (busy = false));
        if (!blob) busy = false;
      },
      "image/jpeg",
      0.7,
    );
  }, FRAME_EVERY_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    video.pause();
    video.srcObject = null;
  };
}

/** Sends the speaker's pictures while the mini window wants them (it stops when the window hides). */
export function useFrameSender(track: MediaStreamTrack | undefined): void {
  const bridge = frameBridge();
  const [wanted, setWanted] = useState(false);
  useEffect(() => bridge?.onFramesWanted(setWanted), [bridge]);
  useEffect(() => {
    if (!bridge || !wanted || !track) return;
    return startSending(track, (frame) => bridge.sendFrame(frame));
  }, [bridge, wanted, track]);
}
