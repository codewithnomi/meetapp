// The own preview with the chosen background (Settings → Devices and pre-join, AC-F15-30): the camera's
// picture goes through the background tool on this computer, and the preview shows what others will see.
import { LocalVideoTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { backgroundsSupported, createBackgroundEffect, type BackgroundEffect } from "./backgrounds.ts";
import { useBackgroundSlow } from "./background-state.ts";

/** The camera stream with the effect on it; the plain stream when there is no effect or no support. */
export function useBackgroundPreview(stream: MediaStream | undefined, background: string): MediaStream | undefined {
  const [processed, setProcessed] = useState<MediaStream>();
  const effect = useRef<BackgroundEffect>(undefined);
  const tell = useBackgroundSlow((state) => state.tell);
  // The tool runs only once an effect is chosen; with None the camera is shown as it is.
  const wanted = background !== "none";
  const camera = wanted ? stream?.getVideoTracks()[0] : undefined;
  useEffect(() => {
    setProcessed(undefined);
    if (!camera || !backgroundsSupported()) return;
    const track = new LocalVideoTrack(camera, undefined, true);
    const made = createBackgroundEffect(tell);
    made.cameraRate(camera.getSettings().frameRate);
    effect.current = made;
    let live = true;
    void track
      .setProcessor(made.processor, true)
      .then(() => {
        const out = made.processor.processedTrack;
        if (live && out) setProcessed(new MediaStream([out]));
      })
      .catch(() => undefined);
    return () => {
      live = false;
      effect.current = undefined;
      void track.stopProcessor().catch(() => undefined);
    };
  }, [camera, tell]);
  useEffect(() => {
    if (processed) void effect.current?.apply(background).catch(() => undefined);
  }, [processed, background]);
  return wanted ? (processed ?? stream) : stream;
}
