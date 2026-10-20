// A person's camera or shared screen in a tile. LiveKit attaches the track to the element; with adaptive
// stream it sends only the size shown, and nothing while the tile is off screen.
import type { VideoTrack } from "livekit-client";
import { useEffect, useRef } from "react";

export function TrackVideo({ track, mirrored = false }: { track: VideoTrack; mirrored?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return undefined;
    track.attach(element);
    return () => void track.detach(element);
  }, [track]);
  // The sound comes separately (hidden audio elements), so the video stays muted.
  return <video ref={video} autoPlay muted playsInline className={mirrored ? "-scale-x-100" : undefined} />;
}
