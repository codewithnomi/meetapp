// The person's own camera, mirrored like a mirror (as in Teams), for the pre-join and lobby tiles.
import { useEffect, useRef } from "react";

export function LocalVideo({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);
  // Muted: it is the person's own picture, with no sound of its own.
  return <video ref={video} autoPlay muted playsInline className="-scale-x-100" />;
}
