// F16: the call screen shares its call and its own button handlers with the mini call window above
// other apps (design.md 3.1, 3.2; AC-F16-15, 16), and takes them back when it closes.
import { useEffect, useState } from "react";
import { callForWindows, speakerOf, useCallScreen, useFrameSender } from "../../features/call-windows/index.ts";
import { can } from "../../features/meetings/index.ts";
import type { CallState } from "./use-call.ts";

/** The mini call window mirrors this screen and presses its buttons (AC-F16-15, 16). */
export function usePublishForMiniWindow(call: CallState, share: () => void) {
  const [joinedAt] = useState(() => Date.now());
  const publish = useCallScreen((state) => state.publish);
  const clear = useCallScreen((state) => state.clear);
  const { room, me, actions, visit } = call;
  // The live video the mini window shows: the shared screen, else the speaker's camera (design.md 3.5).
  const speaker = speakerOf(room.people);
  const video = speaker?.screen ?? (speaker?.cameraOn ? speaker.video : undefined);
  useFrameSender(video?.mediaStreamTrack);
  useEffect(() => {
    publish(
      callForWindows({
        title: visit.title,
        joinedAt,
        people: room.people,
        connection: room.connection,
        may: room.may,
        mayShare: can(me?.role, "share"),
      }),
      {
        toggleMic: actions.microphone,
        toggleCamera: actions.camera,
        share,
        toggleHand: actions.hand,
        leave: actions.leave,
      },
      // F17: the small call view shows the same track, and sends organizers to the Leave menu (AC-F17-05).
      { video, leaveChoices: can(me?.role, "end"), sharing: Boolean(me?.screen) },
    );
  });
  useEffect(() => clear, [clear]);
}
