// GifImage (molecule): a GIF in a chat message (F03 AC-F03-24, 25). It plays unless the person asked
// their computer to reduce motion; either way it can be paused or played, and it is described in words
// for screen readers. Images come straight from KLIPY's image server (D059). Words arrive as props.
import { useState } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";

export interface GifImageProps {
  url: string;
  /** A still picture of the GIF, shown while paused. */
  stillUrl?: string | undefined;
  /** "GIF: thank you, waving cat". */
  description: string;
  width: number;
  height: number;
  /** The computer's "reduce motion" setting: start paused. */
  reduceMotion: boolean;
  labels: { pause: string; play: string; attribution: string };
}

/** GIFs show at most this wide in a chat bubble (the placeholder below matches: w-60 = 240 px). */
const GIF_MAX_WIDTH_PX = 240;

export function GifImage({ url, stillUrl, description, width, height, reduceMotion, labels }: GifImageProps) {
  const [playing, setPlaying] = useState(!reduceMotion);
  const shown = playing || !stillUrl ? url : stillUrl;
  const scale = Math.min(1, GIF_MAX_WIDTH_PX / width);
  return (
    <figure className="relative m-0 flex w-fit flex-col gap-1">
      {playing || stillUrl ? (
        <img
          src={shown}
          alt={description}
          width={Math.round(width * scale)}
          height={Math.round(height * scale)}
          className="rounded-md"
        />
      ) : (
        <div role="img" aria-label={description} className="h-30 w-60 rounded-md bg-surface-sunken" />
      )}
      <IconButton
        icon={playing ? "pause" : "play"}
        label={playing ? labels.pause : labels.play}
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 bg-surface"
        onClick={() => setPlaying(!playing)}
      />
      <figcaption className="text-[11px] text-ink-muted">{labels.attribution}</figcaption>
    </figure>
  );
}
