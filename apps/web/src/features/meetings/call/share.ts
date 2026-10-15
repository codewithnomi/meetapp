// Screen sharing (AC-F02-25, design section 5): in the desktop app the person picks a screen or window in
// our "Choose what to share" picker, the choice goes to the main process, and only then does the app
// ask for the screen (once, within 10 seconds, never with computer sound). A plain browser uses its
// own picker.
import type { Room } from "livekit-client";

export interface ShareSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
}

interface ShareBridge {
  meetapp?: {
    media?: {
      accessStatus: () => Promise<{ screen: string }>;
      getShareSources: () => Promise<ShareSource[]>;
      chooseShareSource: (id: string) => Promise<{ ok: boolean }>;
    };
  };
}

const bridge = () => (window as ShareBridge).meetapp?.media;

/** True when the desktop app shows our picker; false in a plain browser. */
export const hasSharePicker = () => bridge() !== undefined;

/** macOS: screen recording turned off for MeetApp (the picker shows how to turn it on). */
export async function screenBlocked(): Promise<boolean> {
  const status = (
    await bridge()
      ?.accessStatus()
      .catch(() => undefined)
  )?.screen;
  return status === "denied" || status === "restricted";
}

export async function shareSources(): Promise<ShareSource[]> {
  return (
    (await bridge()
      ?.getShareSources()
      .catch(() => [])) ?? []
  );
}

/** Shares the chosen source (or, in a browser, whatever its own picker gives). */
export async function startShare(room: Room, sourceId: string | undefined): Promise<boolean> {
  const media = bridge();
  if (media && sourceId && !(await media.chooseShareSource(sourceId)).ok) return false;
  const shared = await room.localParticipant.setScreenShareEnabled(true, { audio: false }).catch(() => undefined);
  return shared !== undefined;
}

export const stopShare = (room: Room) => room.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
