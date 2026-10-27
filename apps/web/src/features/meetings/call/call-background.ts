// The background effect on the camera sent in a call or meeting (F15 AC-F15-30, 31): the tool is set on
// the camera track when it is published, starting from the remembered choice; a new choice switches it
// without flicker. Others receive the video with the effect already on it.
import { RoomEvent, Track, type LocalTrackPublication, type LocalVideoTrack, type Room } from "livekit-client";
import {
  backgroundsSupported,
  createBackgroundEffect,
  useBackgroundSlow,
  type BackgroundEffect,
} from "../../devices/index.ts";

const effects = new WeakMap<Room, { effect: BackgroundEffect; choice: string }>();

async function attachTo(track: LocalVideoTrack, entry: { effect: BackgroundEffect; choice: string }) {
  await track.setProcessor(entry.effect.processor, true);
  await entry.effect.apply(entry.choice);
}

/** Starts the effect for this room's camera; turning itself off is told through `useBackgroundSlow`. */
export function attachBackground(room: Room, choice: string): void {
  if (!backgroundsSupported()) return;
  const entry = { effect: createBackgroundEffect(() => useBackgroundSlow.getState().tell()), choice };
  effects.set(room, entry);
  room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
    if (publication.source !== Track.Source.Camera || !publication.videoTrack) return;
    void attachTo(publication.videoTrack, entry).catch(() => undefined);
  });
}

/** A new choice during the call. */
export function setBackground(room: Room | undefined, choice: string): void {
  const entry = room ? effects.get(room) : undefined;
  if (!entry) return;
  entry.choice = choice;
  void entry.effect.apply(choice).catch(() => undefined);
}
