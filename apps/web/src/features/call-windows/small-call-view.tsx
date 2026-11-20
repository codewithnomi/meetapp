// F17's small call view (design.md 3.3; AC-F17-02, 04, 05, 07): what it shows, from the same call-screen
// store as F16's mini window, so its buttons run the call screen's own handlers. Leave sends an organizer
// to the full call, where Leave has "End meeting for everyone"; everyone else leaves at once.
import type { SmallCallViewProps } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { TrackVideo, useElapsed } from "../meetings/index.ts";
import { useCallScreen } from "./call-screen.ts";
import { callCaption, micAndCamera } from "./labels.ts";

/** The view's props while a call runs; undefined without one. `showFull` brings the full call back. */
export function useSmallCallView(showFull: () => void): SmallCallViewProps | undefined {
  const { t } = useTranslation();
  const call = useCallScreen((state) => state.call);
  const controls = useCallScreen((state) => state.controls);
  const extras = useCallScreen((state) => state.extras);
  const elapsed = useElapsed(call?.joinedAt);
  if (!call || !controls) return undefined;
  const calling = call.phase === "calling";
  return {
    label: t("calls.windows.miniLabel", { title: call.title }),
    title: call.title,
    elapsed,
    speakerName: call.speaker.name,
    speakerPhoto: call.speaker.photo,
    video: extras.video ? <TrackVideo track={extras.video} /> : undefined,
    caption: callCaption(call, t),
    captionIsStatus: call.phase !== "in-call",
    sharing: extras.sharing ? t("calls.small.sharing") : undefined,
    controls: call.phase === "in-call",
    controlsLabel: t("calls.windows.controls"),
    ...micAndCamera(call, t, { mic: controls.toggleMic, camera: controls.toggleCamera }),
    leave: {
      label: t(calling ? "calls.small.cancelLabel" : "calls.small.leaveLabel", { title: call.title }),
      text: t(calling ? "calls.windows.cancel" : "calls.windows.leave"),
      onClick: extras.leaveChoices ? showFull : controls.leave,
    },
    back: { label: t("calls.small.back", { title: call.title }), text: t("calls.small.goBack"), onClick: showFull },
  };
}
